const API = 'https://api.squeekchain.com/v1';
const $ = (id) => document.getElementById(id);
const formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
let latestCore = null, latestSettlements = null;

function get(obj, names) { return names.map((name) => obj?.[name]).find((value) => value !== undefined && value !== null); }
function display(value, fallback = '—') {
  if (value === undefined || value === null || value === '') return fallback;
  try { return formatter.format(typeof value === 'bigint' ? value : BigInt(value)); } catch { return String(value); }
}
function sqk(value) {
  if (value === undefined || value === null) return '—';
  try { const raw = BigInt(value); return formatter.format(Number(raw / 10n ** 16n) / 100); } catch { return String(value); }
}
function short(value) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : '—'; }
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
  const items = data?.recentSettlements ?? [];
  if (!items.length) { $('events').textContent = 'No recent events returned by the public API.'; return; }
  $('events').innerHTML = items.slice(0, 6).map((event) => {
    return `<a class="event" href="https://sepolia.etherscan.io/tx/${event.transactionHash}" target="_blank" rel="noreferrer"><i></i><span>${display(event.completedBlockCount)} blocks · +${display(event.workAdded)} work<br><small>Height ${display(event.blockHeight)} · ${short(event.transactionHash)}</small></span><time>${event.blockTimestamp ? new Date(event.blockTimestamp).toLocaleString() : 'recent'} ↗</time></a>`;
  }).join('');
}
function renderMilestone() { const target = BigInt($('milestone-input').value || '0'), height = BigInt(latestCore?.blockHeight ?? 0); if (!target || !height) return; const remaining = target > height ? target - height : 0n, done = target <= height, pace = BigInt(latestSettlements?.summary?.completedBlockCount ?? 0), pct = Math.min(100, Number(height * 10000n / target) / 100), eta = !done && pace ? ` · ≈ ${Math.ceil(Number(remaining) / Number(pace))} day(s) at 24h pace` : ''; $('milestone-result').innerHTML = `<div class="progress"><span style="width:${pct}%"></span></div><strong>${done ? 'Milestone reached' : `${display(remaining)} blocks remaining`}</strong><small>Certified height ${display(height)} / target ${display(target)} (${pct}%)${eta}</small>`; }
async function lookupAccount(event) { event.preventDefault(); const address = $('account-input').value.trim(), result = $('account-result'); if (!/^0x[0-9a-fA-F]{40}$/.test(address)) { result.textContent = 'Enter a valid non-zero Ethereum address.'; return; } result.textContent = 'Reading safe-chain account state…'; try { const data = await fetchJson(`/accounts/${address}?limit=25`); if (data.status !== 'available') throw new Error(data.reason ?? 'unavailable'); const count = BigInt(data.tokenCounts?.wallet ?? 0) + BigInt(data.tokenCounts?.staking ?? 0); result.innerHTML = `<div class="account-stats"><div><span>Claimable SQK</span><strong>${sqk(data.rewards?.claimableBaseUnits)}</strong></div><div><span>Squeeks</span><strong>${display(count)}</strong></div><div><span>NFT power</span><strong>${display(data.power?.nftPower)}</strong></div></div>`; } catch (error) { result.textContent = `Account unavailable: ${error.message}`; } }
async function load() {
  $('connection').textContent = 'Refreshing'; $('connection').className = 'pill loading';
  const entries = await Promise.allSettled([
    fetchJson('/status'), fetchJson('/core'), fetchJson('/economy/state'), fetchJson('/settlements?range=24h'),
  ]);
  const [status, core, economy, events] = entries.map((entry) => entry.status === 'fulfilled' ? entry.value : null);
  const failures = entries.filter((entry) => entry.status === 'rejected');
  if (!status && !core && !economy && !events) {
    console.error(entries); $('connection').textContent = 'API unavailable'; $('connection').className = 'pill error';
    $('updated').textContent = 'Public API could not be reached. Try refreshing in a moment.';
    return;
  }

  const coreState = core?.core ?? core ?? {};
  latestCore = coreState; latestSettlements = events;
  const supply = economy?.supply ?? economy ?? {};
  setMetric('height', display(get(coreState, ['blockHeight', 'completedBlockHeight'])), 'height-detail', `Ethereum block ${display(get(core?.source, ['blockNumber']) ?? get(core, ['ethereumBlockNumber', 'blockNumber']))}`);
  setMetric('work', display(get(coreState, ['cumulativeWork', 'cumulativeWorkUnits'])), 'work-detail', 'wheel work units');
  setMetric('difficulty', display(get(coreState, ['workPerThousandBlocks', 'difficulty'])), 'difficulty-detail', 'work / 1k blocks');
  setMetric('minted', sqk(get(supply, ['totalMintedBaseUnits', 'miningMintedBaseUnits'])), 'minted-detail', 'SQK issued');
  if (status) { renderStatus(status); renderMeasurement(status.measurement ?? {}); }
  if (events) renderEvents(events);
  if (!$('milestone-input').value && coreState.blockHeight) $('milestone-input').value = String((Math.floor(Number(coreState.blockHeight) / 100) + 1) * 100); renderMilestone();
  $('connection').textContent = failures.length ? 'Partial data' : 'Live';
  $('connection').className = failures.length ? 'pill loading' : 'pill';
  $('updated').textContent = `Last refreshed ${new Date().toLocaleTimeString()}${failures.length ? ` · ${failures.length} source unavailable` : ''}`;
}
$('refresh').addEventListener('click', load); $('milestone-form').addEventListener('submit', (event) => { event.preventDefault(); renderMilestone(); }); $('account-form').addEventListener('submit', lookupAccount); load(); setInterval(load, 30_000);
