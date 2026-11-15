import { scan, highlight, strictCleanup, countWords } from './scanner.js';

const $ = (id) => document.getElementById(id);
const els = {
  loginView: $('loginView'), appView: $('appView'), loginForm: $('loginForm'), password: $('password'),
  loginError: $('loginError'), logoutBtn: $('logoutBtn'), tone: $('tone'), deep: $('deep'), strict: $('strict'),
  sampleToggle: $('sampleToggle'), sampleWrap: $('sampleWrap'), sample: $('sample'), input: $('input'),
  inHighlight: $('inHighlight'), inScore: $('inScore'), inViewToggle: $('inViewToggle'), inCount: $('inCount'),
  clearBtn: $('clearBtn'), goBtn: $('goBtn'), output: $('output'), outScore: $('outScore'),
  outViewToggle: $('outViewToggle'), status: $('status'), copyBtn: $('copyBtn'), reuseBtn: $('reuseBtn'),
  report: $('report'), beforeList: $('beforeList'), afterList: $('afterList'),
};

let maxChars = 15000;
let outputText = '';
let showOutTells = false;
let controller = null;

// ---------- Session ----------
async function checkSession() {
  try {
    const r = await fetch('/api/session');
    const j = await r.json();
    maxChars = j.maxChars || maxChars;
    setView(j.authed);
  } catch { setView(false); }
}

function setView(authed) {
  els.loginView.classList.toggle('hidden', authed);
  els.appView.classList.toggle('hidden', !authed);
  els.logoutBtn.classList.toggle('hidden', !authed);
  if (authed) els.input.focus(); else els.password.focus();
}

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  els.loginError.textContent = '';
  const r = await fetch('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: els.password.value }),
  });
  if (r.ok) { els.password.value = ''; setView(true); }
  else {
    const j = await r.json().catch(() => ({}));
    els.loginError.textContent = j.error || 'Sign-in failed.';
  }
});

els.logoutBtn.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  setView(false);
});

// ---------- Scoring UI ----------
function scoreBadge(el, result) {
  if (!result.words) { el.hidden = true; return; }
  el.hidden = false;
  const level = result.score >= 60 ? 'high' : result.score >= 25 ? 'mid' : 'low';
  el.className = `score ${level}`;
  el.textContent = `AI tells: ${result.score}`;
  el.title = `${result.matches.length} flagged phrase(s), ${result.density.toFixed(1)} weighted tells per 100 words`;
}

function renderList(ul, result) {
  ul.innerHTML = '';
  const entries = Object.values(result.byPattern).sort((a, b) => b.count - a.count);
  if (!entries.length) {
    ul.innerHTML = '<li class="clean">No tells flagged</li>';
    return;
  }
  for (const { label, count } of entries) {
    const li = document.createElement('li');
    li.innerHTML = `<span></span><b></b>`;
    li.firstChild.textContent = label;
    li.lastChild.textContent = count;
    ul.appendChild(li);
  }
}

function updateInput() {
  const text = els.input.value;
  const r = scan(text);
  const n = countWords(text);
  els.inCount.textContent = `${n} word${n === 1 ? '' : 's'} · ${text.length.toLocaleString()}/${maxChars.toLocaleString()} chars`;
  els.inCount.classList.toggle('error', text.length > maxChars);
  scoreBadge(els.inScore, r);
  if (!els.inHighlight.classList.contains('hidden')) els.inHighlight.innerHTML = highlight(text, r.matches) || '&nbsp;';
  return r;
}

els.input.addEventListener('input', updateInput);

els.inViewToggle.addEventListener('click', () => {
  const showing = !els.inHighlight.classList.contains('hidden');
  if (showing) {
    els.inHighlight.classList.add('hidden');
    els.input.classList.remove('hidden');
    els.inViewToggle.textContent = 'Show tells';
  } else {
    const r = scan(els.input.value);
    els.inHighlight.innerHTML = highlight(els.input.value, r.matches) || '<span class="muted">Nothing to scan yet.</span>';
    els.inHighlight.classList.remove('hidden');
    els.input.classList.add('hidden');
    els.inViewToggle.textContent = 'Edit text';
  }
});

function renderOutput() {
  if (!outputText) return;
  els.output.classList.remove('empty');
  if (showOutTells) {
    els.output.innerHTML = highlight(outputText, scan(outputText).matches);
  } else {
    els.output.textContent = outputText;
  }
}

els.outViewToggle.addEventListener('click', () => {
  showOutTells = !showOutTells;
  els.outViewToggle.textContent = showOutTells ? 'Hide tells' : 'Show tells';
  renderOutput();
});

// ---------- Voice sample ----------
els.sampleToggle.addEventListener('click', () => {
  const open = els.sampleWrap.classList.toggle('hidden') === false;
  els.sampleToggle.setAttribute('aria-expanded', String(open));
  els.sampleToggle.textContent = open ? '− Hide voice sample' : '+ Add a voice sample';
});

// ---------- Humanize ----------
function setBusy(busy) {
  els.goBtn.disabled = false;
  els.goBtn.textContent = busy ? 'Stop' : 'Humanize';
  els.goBtn.classList.toggle('busy', busy);
  els.copyBtn.disabled = busy || !outputText;
  els.reuseBtn.disabled = busy || !outputText;
  els.outViewToggle.disabled = busy || !outputText;
}

async function humanize() {
  if (controller) { controller.abort(); return; }
  const text = els.input.value.trim();
  if (!text) { els.status.textContent = 'Paste some text first.'; return; }
  if (text.length > maxChars) { els.status.textContent = `Too long: max ${maxChars} characters.`; return; }

  const before = scan(text);
  const sample = els.sample.value.trim();
  outputText = '';
  showOutTells = false;
  els.outViewToggle.textContent = 'Show tells';
  els.output.textContent = '';
  els.output.classList.remove('empty');
  els.output.classList.add('streaming');
  els.outScore.hidden = true;
  controller = new AbortController();
  setBusy(true);

  let errored = false;
  try {
    const r = await fetch('/api/humanize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ text, sample, tone: els.tone.value, deep: els.deep.checked }),
    });
    if (r.status === 401) { setView(false); return; }
    if (!r.ok || !r.body) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `Request failed (${r.status})`);
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = /^event: (.+)$/m.exec(chunk)?.[1];
        const data = JSON.parse(/^data: (.*)$/m.exec(chunk)?.[1] || '{}');
        if (ev === 'status') els.status.textContent = data.message;
        else if (ev === 'delta') {
          outputText += data.text;
          els.output.textContent = outputText;
          els.output.scrollTop = els.output.scrollHeight;
        } else if (ev === 'error') { errored = true; els.status.textContent = data.error; }
      }
    }
  } catch (err) {
    if (err.name !== 'AbortError') { errored = true; els.status.textContent = err.message; }
    else els.status.textContent = 'Stopped.';
  } finally {
    controller = null;
    els.output.classList.remove('streaming');
    outputText = outputText.trim();
    if (outputText && els.strict.checked && !sample) outputText = strictCleanup(outputText);
    renderOutput();
    if (outputText) {
      const after = scan(outputText);
      scoreBadge(els.outScore, after);
      renderList(els.beforeList, before);
      renderList(els.afterList, after);
      els.report.classList.remove('hidden');
      if (!errored && els.status.textContent !== 'Stopped.') {
        els.status.textContent = `Done · ${countWords(outputText)} words`;
      }
    } else if (!errored && els.status.textContent !== 'Stopped.') {
      els.output.classList.add('empty');
      els.output.textContent = 'The model returned no text. Try again.';
    }
    setBusy(false);
  }
}

els.goBtn.addEventListener('click', humanize);
els.input.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') humanize();
});

els.clearBtn.addEventListener('click', () => {
  els.input.value = '';
  updateInput();
  els.input.focus();
});

els.copyBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(outputText);
  els.copyBtn.textContent = 'Copied';
  setTimeout(() => (els.copyBtn.textContent = 'Copy'), 1400);
});

els.reuseBtn.addEventListener('click', () => {
  els.input.value = outputText;
  updateInput();
  els.input.focus();
});

checkSession();
