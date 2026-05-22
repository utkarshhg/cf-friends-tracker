// CF Friends Tracker — Background Service Worker

async function sha512(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateApiSig(methodName, params, apiSecret) {
  const rand = String(Math.floor(100000 + Math.random() * 900000));
  const sortedParams = Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&');
  const hash = await sha512(`${rand}/${methodName}?${sortedParams}#${apiSecret}`);
  return rand + hash;
}

async function cfApiCall(methodName, params = {}, requiresAuth = false) {
  const queryParams = { ...params };
  if (requiresAuth) {
    const { apiKey, apiSecret } = await chrome.storage.local.get(['apiKey', 'apiSecret']);
    if (!apiKey || !apiSecret) throw new Error('API credentials not configured. Open extension settings.');
    queryParams.apiKey = apiKey;
    queryParams.time = Math.floor(Date.now() / 1000);
    queryParams.apiSig = await generateApiSig(methodName, queryParams, apiSecret);
  }
  const qs = Object.keys(queryParams).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`).join('&');
  const response = await fetch(`https://codeforces.com/api/${methodName}?${qs}`);
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  const data = await response.json();
  if (data.status !== 'OK') throw new Error(`CF API error: ${data.comment || 'Unknown'}`);
  return data.result;
}

const FRIENDS_TTL = 3600000, SUBS_TTL = 1800000;
async function getCached(key) {
  const r = await chrome.storage.local.get([key]);
  if (r[key]) { const { data, timestamp } = r[key]; const ttl = key === 'friends_list' ? FRIENDS_TTL : SUBS_TTL; if (Date.now() - timestamp < ttl) return data; }
  return null;
}
async function setCache(key, data) { await chrome.storage.local.set({ [key]: { data, timestamp: Date.now() } }); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchFriendsList() {
  const cached = await getCached('friends_list');
  if (cached) return cached;
  const friends = await cfApiCall('user.friends', { onlyOnline: 'false' }, true);
  await setCache('friends_list', friends);
  return friends;
}

async function fetchUsersInfo(handles) {
  if (!handles.length) return [];
  const cacheKey = `uinfo_${[...handles].sort().join(',')}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;
  const info = await cfApiCall('user.info', { handles: handles.join(';') });
  await setCache(cacheKey, info);
  return info;
}

async function fetchFriendSubs(handle, contestId, problemIndex) {
  const cacheKey = `subs_${handle}_${contestId}_${problemIndex}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;
  try {
    const subs = await cfApiCall('user.status', { handle, from: '1', count: '500' });
    const matched = subs.filter(s => s.problem && String(s.problem.contestId) === String(contestId) && s.problem.index === problemIndex)
      .map(s => ({ id: s.id, handle, contestId: s.contestId, problemIndex: s.problem.index, problemName: s.problem.name, verdict: s.verdict || 'TESTING', passedTestCount: s.passedTestCount, timeConsumedMillis: s.timeConsumedMillis, memoryConsumedBytes: s.memoryConsumedBytes, programmingLanguage: s.programmingLanguage, creationTimeSeconds: s.creationTimeSeconds }));
    await setCache(cacheKey, matched);
    return matched;
  } catch (e) { console.warn(`Failed for ${handle}:`, e.message); return []; }
}

async function fetchSubmissionCode(contestId, submissionId) {
  const cacheKey = `code_${contestId}_${submissionId}`;
  const cached = await getCached(cacheKey);
  if (cached) return cached;
  try {
    const resp = await fetch(`https://codeforces.com/contest/${contestId}/submission/${submissionId}`);
    const html = await resp.text();
    const match = html.match(/<pre\s+id="program-source-text"[^>]*>([\s\S]*?)<\/pre>/);
    if (match) {
      let code = match[1].replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ').replace(/<br\s*\/?>/g,'\n').replace(/<[^>]+>/g,'');
      await setCache(cacheKey, code);
      return code;
    }
    return null;
  } catch (e) { return null; }
}

function sendProgress(tabId, message, percent) {
  chrome.tabs.sendMessage(tabId, { type: 'PROGRESS', message, percent }).catch(() => {});
}

async function getFriendsForProblem(contestId, problemIndex, tabId) {
  sendProgress(tabId, 'Fetching friend list...', 0);
  const friends = await fetchFriendsList();
  if (!friends.length) { sendProgress(tabId, 'No friends found', 100); return { friends: [], userInfoMap: {} }; }
  sendProgress(tabId, `Found ${friends.length} friends. Loading info...`, 10);
  let userInfoMap = {};
  try { const infos = await fetchUsersInfo(friends); for (const i of infos) userInfoMap[i.handle] = i; } catch (e) {}
  await sleep(300);
  const allResults = [];
  for (let i = 0; i < friends.length; i++) {
    sendProgress(tabId, `Checking ${friends[i]} (${i+1}/${friends.length})...`, Math.round(15 + (i/friends.length)*80));
    const subs = await fetchFriendSubs(friends[i], contestId, problemIndex);
    if (subs.length) allResults.push(...subs);
    if (i < friends.length - 1) await sleep(300);
  }
  sendProgress(tabId, 'Done!', 100);
  allResults.sort((a, b) => { if (a.verdict === 'OK' && b.verdict !== 'OK') return -1; if (a.verdict !== 'OK' && b.verdict === 'OK') return 1; return b.creationTimeSeconds - a.creationTimeSeconds; });
  return { friends: allResults, userInfoMap };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_FRIENDS_FOR_PROBLEM') {
    const { contestId, problemIndex } = request;
    getFriendsForProblem(contestId, problemIndex, sender.tab.id)
      .then(result => chrome.tabs.sendMessage(sender.tab.id, { type: 'RESULTS', data: result }).catch(() => {}))
      .catch(err => chrome.tabs.sendMessage(sender.tab.id, { type: 'ERROR', message: err.message }).catch(() => {}));
    return true;
  }
  if (request.type === 'FETCH_CODE') {
    fetchSubmissionCode(request.contestId, request.submissionId).then(code => sendResponse({ code })).catch(err => sendResponse({ error: err.message }));
    return true;
  }
  if (request.type === 'TEST_CONNECTION') {
    cfApiCall('user.friends', { onlyOnline: 'false' }, true).then(f => sendResponse({ success: true, friendCount: f.length })).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (request.type === 'CLEAR_CACHE') {
    chrome.storage.local.get(null, items => {
      const keys = Object.keys(items).filter(k => k !== 'apiKey' && k !== 'apiSecret' && k !== 'cfHandle');
      chrome.storage.local.remove(keys, () => sendResponse({ success: true }));
    });
    return true;
  }
});
