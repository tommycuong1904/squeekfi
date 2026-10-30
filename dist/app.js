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
  const keys = [['Pipeline', get(status, ['pipelineStatus', 'status'])], ['Hamster', get(status, ['hamsterStatus', 'hamster'])], ['Updated', get(status, ['observedAt', 'updatedAt'])]];
  $('status-content').innerHTML = `<div class="status-list">${keys.map(([name, value]) => `<div><span>${name}</span><strong>${value ?? '—'}</strong></div>`).join('')}</div>`;
}
function renderMeasurement(data) {
  const values = [['Latest speed', get(data, ['speedMmPerSecond', 'rpmMilli', 'latestSpeed'])], ['Today’s work', get(data, ['todayWorkUnits', 'workUnits'])], ['Last measurement', get(data, ['measuredAt', 'updatedAt'])]];
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
  try {
    const [status, core, measurement, mining, events] = await Promise.all([
      fetchJson('/status'), fetchJson('/core'), fetchJson('/measurement/stats'), fetchJson('/mining/state'), fetchJson('/events'),
    ]);
    setMetric('height', display(get(core, ['blockHeight', 'completedBlockHeight'])), 'height-detail', `Ethereum block ${display(get(core, ['ethereumBlockNumber', 'blockNumber']))}`);
    setMetric('work', display(get(core, ['cumulativeWork', 'cumulativeWorkUnits'])), 'work-detail', 'wheel work units');
    setMetric('difficulty', display(get(core, ['workPerThousandBlocks', 'difficulty'])), 'difficulty-detail', 'work / 1k blocks');
    setMetric('minted', sqk(get(mining, ['mintedBaseUnits', 'totalMintedBaseUnits', 'issuedBaseUnits'])), 'minted-detail', 'SQK issued');
    renderStatus(status); renderMeasurement(measurement); renderEvents(events);
    $('connection').textContent = 'Live'; $('connection').className = 'pill';
    $('updated').textContent = `Last refreshed ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    console.error(error); $('connection').textContent = 'API unavailable'; $('connection').className = 'pill error';
    $('updated').textContent = 'Public API could not be reached. Try refreshing in a moment.';
  }
}
$('refresh').addEventListener('click', load); load(); setInterval(load, 30_000);
