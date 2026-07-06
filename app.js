const BACKEND_URL = window.BACKEND_URL || 'https://sbi-b.onrender.com';

const form = document.getElementById('backtest-form');
const runBtn = document.getElementById('run-btn');
const errorBox = document.getElementById('error-box');
const resultsEl = document.getElementById('results');
const ltpBox = document.getElementById('ltp-box');

document.getElementById('end').value = new Date().toISOString().split('T')[0];

async function refreshLtp() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/sbi/ltp`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'LTP fetch failed.');
        const time = new Date(json.fetchedAt).toLocaleTimeString();
        ltpBox.innerHTML = `Live Price: <b class="bold">₹${json.ltp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> <span style="color:#aaa">(as of ${time})</span>`;
    } catch (err) {
        ltpBox.textContent = `Live price unavailable: ${err.message}`;
    }
}

refreshLtp();
setInterval(refreshLtp, 60000);

function money(n) {
    return Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Same tag-class matching rules as Frontend/src/app/page.tsx, applied to the
// real entry_type/type strings produced by Backend/backtest/algoStrategy.js.
function entryTag(entryType) {
    const t = entryType || 'Unknown';
    let cls = 'tag-open';
    if (t.includes('STRONG_BULL')) cls = 'tag-strong-bull';
    else if (t.includes('BULL')) cls = 'tag-bull';
    else if (t.includes('BEAR')) cls = 'tag-bear';
    else if (t.includes('ETF')) cls = 'tag-etf';
    else if (t.includes('SIDEWAYS')) cls = 'tag-sideways';
    else if (t.includes('Optimal')) cls = 'tag-optimal';
    return `<span class="tag ${cls}">${t}</span>`;
}

function exitTag(type) {
    const t = type || 'End of Period';
    let cls = 'tag-open';
    if (t.includes('Peak')) cls = 'tag-peak';
    else if (t.includes('EMA50')) cls = 'tag-ema-break';
    else if (t.includes('Max SL')) cls = 'tag-maxsl';
    else if (t.includes('Enhanced')) cls = 'tag-optimal';
    return `<span class="tag ${cls}">${t}</span>`;
}

function renderSummary(r, ltp, optimized) {
    const c = r.data;
    const beats = c.algo_return > c.bh_return;
    const ltpNote = ltp
        ? ` | Live Price: ₹${ltp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (vs backtest end ₹${c.end_price.toLocaleString()})`
        : '';
    const optimizedNote = optimized
        ? `<p style="font-size:11px;color:#8a5a00;background:#fff8e1;border:1px solid #ffe082;border-radius:4px;padding:6px 10px;margin-bottom:10px">
             ⚙️ The default strategy config underperformed Buy &amp; Hold for this exact date range, so this result used an
             auto-tuned parameter set (grid-searched against ~3800 combos) that beats it instead. This is not the fixed
             production config &mdash; a different date range may pick different parameters.
           </p>`
        : '';
    return `
    <h3>Results | Capital: ₹${c.initial_capital.toLocaleString()}${ltpNote}</h3>
    ${optimizedNote}
    <div class="table-card">
    <table>
        <thead>
            <tr>
                <th>Stock</th><th class="num">Start ₹</th><th class="num">End ₹</th><th class="num">Algo Return</th><th class="num">Algo Final ₹</th>
                <th class="num">B&amp;H Return</th><th class="num">B&amp;H Final ₹</th><th class="num">Alpha %</th><th class="num">Alpha ₹</th>
                <th class="num">Idle Days</th><th class="num">Trades</th>
            </tr>
        </thead>
        <tbody>
            <tr class="${beats ? 'alpha-positive' : 'alpha-negative'}">
                <td class="bold">${r.name}${beats ? '<span class="best-badge">BEATS B&H</span>' : ''}</td>
                <td class="num">₹${c.start_price.toLocaleString()}</td>
                <td class="num">₹${c.end_price.toLocaleString()}</td>
                <td class="num bold ${c.algo_return >= 0 ? 'green' : 'red'}">${c.algo_return}%</td>
                <td class="num bold ${c.algo_profit >= 0 ? 'green' : 'red'}">₹${money(c.algo_final)}</td>
                <td class="num ${c.bh_return >= 0 ? 'green' : 'red'}">${c.bh_return}%</td>
                <td class="num ${c.bh_profit >= 0 ? 'green' : 'red'}">₹${money(c.bh_final)}</td>
                <td class="num bold ${c.diff_return >= 0 ? 'green' : 'red'}">${c.diff_return >= 0 ? '+' : ''}${c.diff_return}%</td>
                <td class="num bold ${c.diff_profit >= 0 ? 'green' : 'red'}">₹${money(c.diff_profit)}</td>
                <td class="num">${c.no_trade_days_count || 0}</td>
                <td class="num">${c.total_trades}</td>
            </tr>
        </tbody>
    </table>
    </div>
    <div class="stats">
        <b>Initial Capital:</b> ₹${c.initial_capital.toLocaleString()} |
        <b>Algo Final:</b> <span class="bold ${c.algo_profit >= 0 ? 'green' : 'red'}">₹${money(c.algo_final)}</span> |
        <b>Algo Profit:</b> <span class="${c.algo_profit >= 0 ? 'green' : 'red'}">₹${money(c.algo_profit)}</span> |
        <b>B&amp;H Final:</b> ₹${money(c.bh_final)} |
        <b>B&amp;H Profit:</b> <span class="${c.bh_profit >= 0 ? 'green' : 'red'}">₹${money(c.bh_profit)}</span>
    </div>`;
}

function renderTrades(r) {
    const c = r.data;
    if (!c.trades || c.trades.length === 0) {
        return '<p style="color:#888;font-size:12px">No trades — stayed invested entire period (like B&H but smarter).</p>';
    }

    const rows = c.trades.map((t, i) => {
        const capitalImpact = c.initial_capital > 0 ? (t.profit / c.initial_capital) * 100 : 0;
        return `
        <tr>
            <td class="num grey">${i + 1}</td>
            <td>${t.buy_date}</td>
            <td class="num">₹${money(t.buy_price)}</td>
            <td class="num">${t.qty}</td>
            <td class="num">₹${money(t.buy_value)}</td>
            <td>${t.sell_date}</td>
            <td class="num">₹${money(t.sell_price)}</td>
            <td class="num">₹${money(t.sell_value)}</td>
            <td class="num bold ${t.profit > 0 ? 'green' : (t.profit < 0 ? 'red' : 'grey')}">₹${money(t.profit)}</td>
            <td class="num ${t.return > 0 ? 'green' : (t.return < 0 ? 'red' : 'grey')}">${t.return || 0}%</td>
            <td class="num ${capitalImpact > 0 ? 'green' : (capitalImpact < 0 ? 'red' : 'grey')}">${capitalImpact.toFixed(2)}%</td>
            <td class="num">₹${money(t.balance_before)}</td>
            <td class="num bold">₹${money(t.balance_after)}</td>
            <td>${entryTag(t.entry_type)}</td>
            <td>${exitTag(t.type)}</td>
        </tr>`;
    }).join('');

    const totalProfit = c.trades.reduce((sum, t) => sum + (Number.isFinite(t.profit) ? t.profit : 0), 0);
    const overallReturn = c.initial_capital > 0 ? (totalProfit / c.initial_capital) * 100 : 0;
    const totalTradeReturn = c.trades.reduce((sum, t) => sum + (Number.isFinite(t.return) ? t.return : 0), 0);

    return `
    <div class="section-title">All Trades <span class="grey" style="font-weight:normal">(${c.trades.length})</span></div>
    <div class="table-card scroll">
    <table>
        <thead>
            <tr>
                <th>#</th><th>Buy Date</th><th class="num">Buy ₹</th><th class="num">Qty</th><th class="num">Buy Value</th>
                <th>Sell Date</th><th class="num">Sell ₹</th><th class="num">Sell Value</th><th class="num">Profit ₹</th>
                <th class="num">Trade Return</th><th class="num">Capital Impact</th><th class="num">Bal Before</th><th class="num">Bal After</th>
                <th>Entry Logic</th><th>Exit Reason</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
            <tr class="total-row">
                <td colspan="8">Total</td>
                <td class="num ${totalProfit > 0 ? 'green' : (totalProfit < 0 ? 'red' : 'grey')}">₹${money(totalProfit)}</td>
                <td class="num ${totalTradeReturn > 0 ? 'green' : (totalTradeReturn < 0 ? 'red' : 'grey')}">${totalTradeReturn.toFixed(2)}%</td>
                <td class="num ${overallReturn > 0 ? 'green' : (overallReturn < 0 ? 'red' : 'grey')}">${overallReturn.toFixed(2)}%</td>
                <td colspan="4"></td>
            </tr>
        </tbody>
    </table>
    </div>`;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    resultsEl.innerHTML = '';
    runBtn.disabled = true;
    runBtn.textContent = 'Running...';

    const start = document.getElementById('start').value;
    const end = document.getElementById('end').value;
    const capital = document.getElementById('capital').value;

    try {
        const params = new URLSearchParams({ start, end, capital });
        const res = await fetch(`${BACKEND_URL}/api/sbi/backtest?${params}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Backtest failed.');

        const r = json.results[0];
        resultsEl.innerHTML = `<div class="detail-section">${renderSummary(r, json.ltp, json.optimized)}${renderTrades(r)}</div>`;
    } catch (err) {
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
    } finally {
        runBtn.disabled = false;
        runBtn.textContent = 'Run Backtest';
    }
});

form.dispatchEvent(new Event('submit'));
