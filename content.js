// CF Friends Tracker — Content Script
// Injects the friends panel into Codeforces problem pages

(function () {
  'use strict';

  // ── Detect problem from URL ──────────────────────────────
  function detectProblem() {
    const url = window.location.pathname;
    let match;
    // /problemset/problem/1/A
    match = url.match(/\/problemset\/problem\/(\d+)\/([A-Za-z0-9]+)/);
    if (match) return { contestId: match[1], problemIndex: match[2] };
    // /contest/1/problem/A or /gym/1/problem/A
    match = url.match(/\/(contest|gym)\/(\d+)\/problem\/([A-Za-z0-9]+)/);
    if (match) return { contestId: match[2], problemIndex: match[3] };
    return null;
  }

  const problem = detectProblem();
  if (!problem) return;

  // ── Rating Color Helper ──────────────────────────────────
  function getRatingClass(rating) {
    if (!rating) return 'cf-rank-newbie';
    if (rating < 1200) return 'cf-rank-newbie';
    if (rating < 1400) return 'cf-rank-pupil';
    if (rating < 1600) return 'cf-rank-specialist';
    if (rating < 1900) return 'cf-rank-expert';
    if (rating < 2100) return 'cf-rank-cm';
    if (rating < 2400) return 'cf-rank-master';
    if (rating < 3000) return 'cf-rank-grandmaster';
    return 'cf-rank-legendary';
  }

  function getRankTitle(rating) {
    if (!rating) return 'Unrated';
    if (rating < 1200) return 'Newbie';
    if (rating < 1400) return 'Pupil';
    if (rating < 1600) return 'Specialist';
    if (rating < 1900) return 'Expert';
    if (rating < 2100) return 'Candidate Master';
    if (rating < 2400) return 'Master';
    if (rating < 3000) return 'Grandmaster';
    return 'Legendary GM';
  }

  // ── Verdict Helpers ──────────────────────────────────────
  function getVerdictInfo(verdict) {
    const map = {
      'OK': { icon: '✅', label: 'Accepted', cls: 'verdict-ac' },
      'WRONG_ANSWER': { icon: '❌', label: 'Wrong Answer', cls: 'verdict-wa' },
      'TIME_LIMIT_EXCEEDED': { icon: '⏱️', label: 'Time Limit', cls: 'verdict-tle' },
      'MEMORY_LIMIT_EXCEEDED': { icon: '💾', label: 'Memory Limit', cls: 'verdict-mle' },
      'RUNTIME_ERROR': { icon: '💥', label: 'Runtime Error', cls: 'verdict-re' },
      'COMPILATION_ERROR': { icon: '🔧', label: 'Compile Error', cls: 'verdict-ce' },
      'TESTING': { icon: '⏳', label: 'Testing...', cls: 'verdict-other' },
      'CHALLENGED': { icon: '⚔️', label: 'Challenged', cls: 'verdict-wa' },
      'SKIPPED': { icon: '⏭️', label: 'Skipped', cls: 'verdict-other' },
    };
    return map[verdict] || { icon: '❓', label: verdict, cls: 'verdict-other' };
  }

  function formatTime(ms) {
    if (ms === undefined || ms === null) return '';
    return `${ms}ms`;
  }

  function formatMemory(bytes) {
    if (bytes === undefined || bytes === null) return '';
    return `${(bytes / 1024).toFixed(0)}KB`;
  }

  function formatDate(ts) {
    const d = new Date(ts * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Create Panel ─────────────────────────────────────────
  function createPanel() {
    const panel = document.createElement('div');
    panel.id = 'cft-panel';
    panel.innerHTML = `
      <div class="cft-header">
        <div class="cft-header-left">
          <span class="cft-logo">👥</span>
          <span class="cft-title">Friends Tracker</span>
        </div>
        <button class="cft-refresh-btn" id="cft-refresh" title="Refresh">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
        </button>
      </div>
      <div class="cft-progress" id="cft-progress">
        <div class="cft-progress-bar-track">
          <div class="cft-progress-bar-fill" id="cft-progress-fill"></div>
        </div>
        <div class="cft-progress-text" id="cft-progress-text">Initializing...</div>
      </div>
      <div class="cft-body" id="cft-body" style="display:none;"></div>
    `;
    return panel;
  }

  // ── Render Results ───────────────────────────────────────
  function renderResults(data) {
    const body = document.getElementById('cft-body');
    const progress = document.getElementById('cft-progress');
    progress.style.display = 'none';
    body.style.display = 'block';

    const { friends: submissions, userInfoMap } = data;

    if (!submissions || submissions.length === 0) {
      body.innerHTML = `
        <div class="cft-empty">
          <div class="cft-empty-icon">🔍</div>
          <div class="cft-empty-text">None of your friends have attempted this problem yet.</div>
        </div>
      `;
      return;
    }

    // Group by handle: for each friend, pick their best submission (OK > other) and most recent
    const friendMap = {};
    for (const sub of submissions) {
      if (!friendMap[sub.handle]) friendMap[sub.handle] = [];
      friendMap[sub.handle].push(sub);
    }

    // For summary stats
    let solvedCount = 0;
    let attemptedCount = 0;
    const friendHandles = Object.keys(friendMap);

    // Sort: friends who solved first, then by rating
    friendHandles.sort((a, b) => {
      const aOk = friendMap[a].some(s => s.verdict === 'OK');
      const bOk = friendMap[b].some(s => s.verdict === 'OK');
      if (aOk && !bOk) return -1;
      if (!aOk && bOk) return 1;
      const ra = (userInfoMap[a] && userInfoMap[a].rating) || 0;
      const rb = (userInfoMap[b] && userInfoMap[b].rating) || 0;
      return rb - ra;
    });

    let html = '<div class="cft-results">';

    for (const handle of friendHandles) {
      const subs = friendMap[handle];
      const bestSub = subs.find(s => s.verdict === 'OK') || subs[0];
      const info = userInfoMap[handle];
      const rating = info ? info.rating : null;
      const ratingCls = getRatingClass(rating);
      const rankTitle = getRankTitle(rating);
      const avatar = info && info.titlePhoto ? info.titlePhoto : '';
      const vInfo = getVerdictInfo(bestSub.verdict);

      if (bestSub.verdict === 'OK') solvedCount++;
      else attemptedCount++;

      const avatarUrl = avatar.startsWith('//') ? 'https:' + avatar : avatar;

      html += `
        <div class="cft-friend-card" data-handle="${handle}">
          <div class="cft-friend-main">
            <div class="cft-friend-avatar">
              ${avatarUrl ? `<img src="${avatarUrl}" alt="${handle}" onerror="this.style.display='none'"/>` : ''}
              <span class="cft-verdict-badge ${vInfo.cls}">${vInfo.icon}</span>
            </div>
            <div class="cft-friend-info">
              <div class="cft-friend-name">
                <a href="https://codeforces.com/profile/${handle}" target="_blank" class="${ratingCls}">${handle}</a>
                <span class="cft-friend-rating ${ratingCls}">${rating || '—'}</span>
              </div>
              <div class="cft-friend-verdict ${vInfo.cls}">
                ${vInfo.label}${bestSub.verdict !== 'OK' && bestSub.passedTestCount !== undefined ? ` on test ${bestSub.passedTestCount + 1}` : ''}
              </div>
              <div class="cft-friend-meta">
                <span>${bestSub.programmingLanguage || ''}</span>
                ${bestSub.timeConsumedMillis !== undefined ? `<span>· ${formatTime(bestSub.timeConsumedMillis)}</span>` : ''}
                ${bestSub.memoryConsumedBytes !== undefined ? `<span>· ${formatMemory(bestSub.memoryConsumedBytes)}</span>` : ''}
              </div>
            </div>
            <button class="cft-view-code-btn" data-contest="${bestSub.contestId}" data-subid="${bestSub.id}" title="View Solution">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 18 22 12 16 6"></polyline>
                <polyline points="8 6 2 12 8 18"></polyline>
              </svg>
            </button>
          </div>
          <div class="cft-code-container" id="cft-code-${bestSub.id}" style="display:none;">
            <div class="cft-code-header">
              <span>${bestSub.programmingLanguage || 'Code'}</span>
              <div class="cft-code-actions">
                <button class="cft-copy-btn" data-subid="${bestSub.id}" title="Copy code">📋</button>
                <a href="https://codeforces.com/contest/${bestSub.contestId}/submission/${bestSub.id}" target="_blank" class="cft-link-btn" title="Open on Codeforces">🔗</a>
              </div>
            </div>
            <pre class="cft-code-block"><code>Loading...</code></pre>
          </div>
        </div>
      `;

      // If friend has multiple submissions, add collapsible history
      if (subs.length > 1) {
        html += `<div class="cft-history-toggle" data-handle="${handle}">
          <span>▸ ${subs.length - 1} more submission${subs.length > 2 ? 's' : ''}</span>
        </div>`;
        html += `<div class="cft-history" id="cft-history-${handle}" style="display:none;">`;
        for (let i = 1; i < subs.length; i++) {
          const s = subs[i];
          const vi = getVerdictInfo(s.verdict);
          html += `
            <div class="cft-history-item">
              <span class="${vi.cls}">${vi.icon} ${vi.label}</span>
              <span>${s.programmingLanguage || ''}</span>
              <span>${formatDate(s.creationTimeSeconds)}</span>
              <button class="cft-view-code-btn cft-small-btn" data-contest="${s.contestId}" data-subid="${s.id}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>
                </svg>
              </button>
            </div>`;
        }
        html += '</div>';
      }
    }

    html += '</div>';

    // Summary footer
    html += `
      <div class="cft-summary">
        <span class="cft-summary-item cft-summary-solved">${solvedCount} solved</span>
        <span class="cft-summary-sep">·</span>
        <span class="cft-summary-item cft-summary-attempted">${attemptedCount} attempted</span>
      </div>
    `;

    body.innerHTML = html;

    // Attach event listeners for code viewing
    body.querySelectorAll('.cft-view-code-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const contestId = btn.dataset.contest;
        const subId = btn.dataset.subid;
        toggleCode(contestId, subId);
      });
    });

    // Copy buttons
    body.querySelectorAll('.cft-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const subId = btn.dataset.subid;
        const codeEl = document.querySelector(`#cft-code-${subId} code`);
        if (codeEl) {
          navigator.clipboard.writeText(codeEl.textContent).then(() => {
            btn.textContent = '✅';
            setTimeout(() => btn.textContent = '📋', 1500);
          });
        }
      });
    });

    // History toggles
    body.querySelectorAll('.cft-history-toggle').forEach(toggle => {
      toggle.addEventListener('click', () => {
        const handle = toggle.dataset.handle;
        const history = document.getElementById(`cft-history-${handle}`);
        if (history) {
          const isHidden = history.style.display === 'none';
          history.style.display = isHidden ? 'block' : 'none';
          toggle.querySelector('span').textContent = (isHidden ? '▾ ' : '▸ ') +
            toggle.querySelector('span').textContent.substring(2);
        }
      });
    });
  }

  // ── Toggle Code View ────────────────────────────────────
  function toggleCode(contestId, submissionId) {
    const container = document.getElementById(`cft-code-${submissionId}`);
    if (!container) return;

    if (container.style.display === 'none') {
      container.style.display = 'block';
      const codeEl = container.querySelector('code');
      if (codeEl.textContent === 'Loading...') {
        chrome.runtime.sendMessage(
          { type: 'FETCH_CODE', contestId, submissionId },
          (response) => {
            if (response && response.code) {
              codeEl.textContent = response.code;
            } else {
              codeEl.textContent = '// Could not load source code.\n// You may need to be logged in or the submission may be private.';
            }
          }
        );
      }
    } else {
      container.style.display = 'none';
    }
  }

  // ── Inject Panel into Page ───────────────────────────────
  function injectPanel() {
    // Find the sidebar
    const sidebar = document.querySelector('#sidebar') ||
      document.querySelector('.roundbox.sidebox')?.parentElement;

    if (!sidebar) {
      // Fallback: create floating panel
      const panel = createPanel();
      panel.classList.add('cft-floating');
      document.body.appendChild(panel);
      return panel;
    }

    const panel = createPanel();
    // Insert at the top of sidebar
    sidebar.insertBefore(panel, sidebar.firstChild);
    return panel;
  }

  // ── Message Listener ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'PROGRESS') {
      const fill = document.getElementById('cft-progress-fill');
      const text = document.getElementById('cft-progress-text');
      const progress = document.getElementById('cft-progress');
      if (fill) fill.style.width = msg.percent + '%';
      if (text) text.textContent = msg.message;
      if (progress) progress.style.display = 'block';
    }
    if (msg.type === 'RESULTS') {
      renderResults(msg.data);
    }
    if (msg.type === 'ERROR') {
      const body = document.getElementById('cft-body');
      const progress = document.getElementById('cft-progress');
      if (progress) progress.style.display = 'none';
      if (body) {
        body.style.display = 'block';
        body.innerHTML = `
          <div class="cft-error">
            <div class="cft-error-icon">⚠️</div>
            <div class="cft-error-text">${msg.message}</div>
            <button class="cft-retry-btn" id="cft-retry">Try Again</button>
          </div>
        `;
        document.getElementById('cft-retry')?.addEventListener('click', startFetch);
      }
    }
  });

  // ── Start Fetching ───────────────────────────────────────
  function startFetch() {
    const body = document.getElementById('cft-body');
    const progress = document.getElementById('cft-progress');
    if (body) body.style.display = 'none';
    if (progress) progress.style.display = 'block';
    const fill = document.getElementById('cft-progress-fill');
    if (fill) fill.style.width = '0%';

    chrome.runtime.sendMessage({
      type: 'GET_FRIENDS_FOR_PROBLEM',
      contestId: problem.contestId,
      problemIndex: problem.problemIndex
    });
  }

  // ── Initialize ───────────────────────────────────────────
  const panel = injectPanel();
  if (panel) {
    document.getElementById('cft-refresh')?.addEventListener('click', startFetch);
    startFetch();
  }
})();
