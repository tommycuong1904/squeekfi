const API = 'https://api.squeekchain.com/v1';
const $ = (id) => document.getElementById(id);
const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function get(obj, names) { return names.map((name) => obj?.[name]).find((value) => value !== undefined && value !== null); }
function display(value, fallback = '—') {
  if (value === undefined || value === null || value === '') return fallback;
  try { return formatter.format(typeof value === 'bigint' ? value : BigInt(value)); } catch { return String(value); }
}
function sqk(value) {
  if (value === undefined || value === null) return '—';
  try { const raw = BigInt(value); return formatter.format(Number(raw / 10n ** 16n) / 100); } catch { return String(value); }
}
async function fetchJson(path) {
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}
function setMetric(id, value, detailId, detail) { $(id).textContent = value; if (detail) $(detailId).textContent = detail; }
function renderStatus(status) {
  const unavailable = status?.status === 'unavailable';
  $('pipeline-dot').classList.toggle('live', !unavailable);
  const measurement = status?.measurement ?? {};
  const keys = [
    ['Pipeline', get(status?.builder, ['status']) ?? get(status, ['pipelineStatus', 'status'])],
    ['Hamster', get(measurement, ['coreStatus', 'hamsterStatus', 'hamster'])],
    ['Updated', get(status, ['generatedAt', 'observedAt', 'updatedAt'])],
  ];
  $('status-content').innerHTML = `<div class="status-list">${keys.map(([name, value]) => `<div><span>${name}</span><strong>${value ?? '—'}</strong></div>`).join('')}</div>`;
}
function renderMeasurement(data) {
  const values = [
    ['Latest speed', get(data, ['rpmMilli', 'speedMmPerSecond', 'latestSpeed'])],
    ['Total work', get(data, ['cumulativeWorkUnits', 'workUnits'])],
    ['Last measurement', get(data, ['observedAt', 'measuredAt', 'updatedAt'])],
  ];
  $('measurement').innerHTML = values.map(([name, value]) => `<div><dt>${name}</dt><dd>${display(value)}</dd></div>`).join('');
}
function renderEvents(data) {
  const items = Array.isArray(data) ? data : (data?.events ?? data?.items ?? []);
  if (!items.length) { $('events').textContent = 'No recent events returned by the public API.'; return; }
  $('events').innerHTML = items.slice(0, 6).map((event) => {
    const label = get(event, ['type', 'eventName', 'kind']) ?? 'On-chain activity';
    const at = get(event, ['timestamp', 'occurredAt', 'blockTimestamp']);
    return `<div class="event"><i></i><span>${label}</span><time>${at ? new Date(at).toLocaleString() : 'recent'}</time></div>`;
  }).join('');
}
async function load() {
  $('connection').textContent = 'Refreshing'; $('connection').className = 'pill loading';
  const entries = await Promise.allSettled([
    fetchJson('/status'), fetchJson('/core'), fetchJson('/economy/state'), fetchJson('/events'),
  ]);
  const [status, core, economy, events] = entries.map((entry) => entry.status === 'fulfilled' ? entry.value : null);
  const failures = entries.filter((entry) => entry.status === 'rejected');
  if (!status && !core && !economy && !events) {
    console.error(entries); $('connection').textContent = 'API unavailable'; $('connection').className = 'pill error';
    $('updated').textContent = 'Public API could not be reached. Try refreshing in a moment.';
    return;
  }

  const coreState = core?.core ?? core ?? {};
  const supply = economy?.supply ?? economy ?? {};
  setMetric('height', display(get(coreState, ['blockHeight', 'completedBlockHeight'])), 'height-detail', `Ethereum block ${display(get(core?.source, ['blockNumber']) ?? get(core, ['ethereumBlockNumber', 'blockNumber']))}`);
  setMetric('work', display(get(coreState, ['cumulativeWork', 'cumulativeWorkUnits'])), 'work-detail', 'wheel work units');
  setMetric('difficulty', display(get(coreState, ['workPerThousandBlocks', 'difficulty'])), 'difficulty-detail', 'work / 1k blocks');
  setMetric('minted', sqk(get(supply, ['totalMintedBaseUnits', 'miningMintedBaseUnits'])), 'minted-detail', 'SQK issued');
  if (status) { renderStatus(status); renderMeasurement(status.measurement ?? {}); }
  if (events) renderEvents(events);
  $('connection').textContent = failures.length ? 'Partial data' : 'Live';
  $('connection').className = failures.length ? 'pill loading' : 'pill';
  $('updated').textContent = `Last refreshed ${new Date().toLocaleTimeString()}${failures.length ? ` · ${failures.length} source unavailable` : ''}`;
}
$('refresh').addEventListener('click', load); load(); setInterval(load, 30_000);
