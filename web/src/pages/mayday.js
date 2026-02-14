/**
 * Mayday / Distress Call Page
 * Fresh fetch from Supabase on every entry. Setup form + VHF script (MAYDAY, PAN-PAN, SÉCURITÉ).
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import { getBoat, getBoatDistressInfo, upsertBoatDistressInfo, isBoatArchived } from '../lib/dataService.js';
import { getVesselNamePhonetic, getCallsignPhonetic } from '../lib/phonetic.js';

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

const DISTRESS_NATURES = [
  { value: 'sinking', label: 'Sinking' },
  { value: 'fire', label: 'Fire' },
  { value: 'man_overboard', label: 'Man overboard' },
  { value: 'collision', label: 'Collision' },
  { value: 'grounding', label: 'Grounding' },
  { value: 'medical_emergency', label: 'Medical emergency' },
  { value: 'taking_on_water', label: 'Taking on water' },
  { value: 'disabled_drifting', label: 'Disabled and drifting' },
  { value: 'other', label: 'Other' }
];

let currentBoatId = null;
let boat = null;
let distressInfo = null;
let maydayArchived = false;

// "At the moment" state (not saved unless user chooses)
let incidentPosition = '';
let incidentNature = '';
let incidentNotes = '';

function getScriptPreamble(type) {
  if (type === 'mayday') return 'MAYDAY MAYDAY MAYDAY';
  if (type === 'panpan') return 'PAN-PAN PAN-PAN PAN-PAN';
  return 'SÉCURITÉ SÉCURITÉ SÉCURITÉ';
}

function getAssistanceLine(type) {
  if (type === 'mayday') return 'I require immediate assistance.';
  if (type === 'panpan') return 'I require assistance.';
  return 'Safety broadcast.';
}

function buildScript(type, info, boatName, positionText, natureText, incidentNotesText) {
  const lines = [];
  const preamble = getScriptPreamble(type);
  lines.push(preamble);
  lines.push(`This is ${info.vesselName}, ${info.vesselName}, ${info.vesselName}.`);
  if (info.vesselPhonetic) {
    lines.push(`Spelling: ${info.vesselPhonetic}.`);
  }
  if (info.callsign) {
    lines.push(`Callsign: ${info.callsign}${info.callsignPhonetic ? ` – ${info.callsignPhonetic}` : ''}.`);
  }
  if (info.mmsi) {
    lines.push(`MMSI: ${info.mmsi}.`);
  }
  const pos = (positionText || '').trim() || 'My position is: ___ degrees ___ minutes ___ (N/S), ___ degrees ___ minutes ___ (E/W). Or: I am located ___ (bearing/distance from landmark).';
  lines.push(pos);
  if (natureText) {
    lines.push(`Nature: ${natureText}.`);
  }
  lines.push(getAssistanceLine(type));
  if (info.personsOnBoard != null) {
    lines.push(`${info.personsOnBoard} person(s) on board.`);
  }
  const extras = [];
  if (info.vesselDesc) extras.push(info.vesselDesc);
  if (info.equipmentDesc) extras.push(info.equipmentDesc);
  if (extras.length) lines.push(extras.join('. '));
  if (incidentNotesText && incidentNotesText.trim()) {
    lines.push(incidentNotesText.trim());
  }
  lines.push('Over.');
  return lines.filter(Boolean);
}

function getDistressInfoForScript(d) {
  const vesselName = (d && d.vessel_name) || '';
  const vesselPhonetic = getVesselNamePhonetic(vesselName, d?.vessel_name_phonetic);
  const callsignPhonetic = getCallsignPhonetic(d?.callsign || '', d?.callsign_phonetic);
  const vesselDesc = [d?.vessel_type, d?.hull_colour, d?.length_m != null ? `${d.length_m}m` : null].filter(Boolean).join(', ') || null;
  const eq = [];
  if (d?.liferaft) eq.push('liferaft');
  if (d?.epirb) eq.push('EPIRB' + (d.epirb_hex_id ? ` ${d.epirb_hex_id}` : ''));
  if (d?.plb) eq.push('PLB');
  if (d?.ais) eq.push('AIS');
  const equipmentDesc = eq.length ? eq.join(', ') : null;
  return {
    vesselName: vesselName || 'Vessel',
    vesselPhonetic,
    callsign: d?.callsign || null,
    callsignPhonetic: callsignPhonetic || null,
    mmsi: d?.mmsi || null,
    personsOnBoard: d?.persons_on_board,
    vesselDesc,
    equipmentDesc
  };
}

function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapper;
  }

  const wrapper = document.createElement('div');
  const header = createYachtHeader('Mayday / Distress Call');
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-mayday';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  container.innerHTML = `
    <p class="text-muted mayday-disclaimer">In an emergency, follow official coastguard guidance. This tool helps you read a clear message.</p>

    <div class="card mayday-readout-card" id="mayday-script-card" style="display: none;">
      <h3>Read this out</h3>
      <p class="script-instruction">Read each line slowly and clearly over VHF Channel 16. Say the full message three times.</p>
      <div class="script-tabs">
        <button type="button" class="script-tab active" data-script="mayday">MAYDAY</button>
        <button type="button" class="script-tab" data-script="panpan">PAN-PAN</button>
        <button type="button" class="script-tab" data-script="securite">SÉCURITÉ</button>
      </div>
      <div class="script-content">
        <pre id="mayday-script-text" class="script-text script-text-readout"></pre>
      </div>
      <div class="form-actions script-actions script-actions-sticky">
        <button type="button" class="btn-secondary" id="mayday-read-btn">Read script</button>
        <button type="button" class="btn-primary" id="mayday-copy-btn-top">Copy script</button>
      </div>
    </div>

    <div class="card" id="mayday-incident-card">
      <h3>At the moment (for this incident)</h3>
      <p class="text-muted">Fill in position and nature below — the script above updates as you type. Then read it out or copy it.</p>
      <div class="form-group">
        <label for="mayday_incident_position">Position</label>
        <input type="text" id="mayday_incident_position" placeholder="e.g. 50°45.2N 001°12.4W or 2 nm SW of Needles">
      </div>
      <div class="form-group">
        <label for="mayday_incident_nature">Nature of distress</label>
        <select id="mayday_incident_nature">
          <option value="">— Select —</option>
          ${DISTRESS_NATURES.map((n) => `<option value="${n.value}">${n.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="mayday_incident_notes">Immediate notes</label>
        <textarea id="mayday_incident_notes" rows="2" placeholder="e.g. taking water, need pump"></textarea>
      </div>
    </div>

    <div class="card" id="mayday-setup-card">
      <h3>Vessel &amp; emergency details</h3>
      <p class="text-muted">Set this up now so it's ready when you need it.</p>
      <form id="mayday-setup-form">
        <fieldset class="form-section">
          <legend>Vessel identity</legend>
          <div class="form-group">
            <label for="mayday_vessel_name">Vessel name *</label>
            <input type="text" id="mayday_vessel_name" required placeholder="e.g. Midnight Star">
          </div>
          <div class="form-group">
            <label for="mayday_vessel_name_phonetic">Vessel name phonetic (override)</label>
            <input type="text" id="mayday_vessel_name_phonetic" placeholder="Leave blank to auto-generate">
          </div>
          <div class="form-group">
            <label for="mayday_callsign">Callsign</label>
            <input type="text" id="mayday_callsign" placeholder="e.g. MABC123">
          </div>
          <div class="form-group">
            <label for="mayday_callsign_phonetic">Callsign phonetic (override)</label>
            <input type="text" id="mayday_callsign_phonetic" placeholder="Leave blank to auto-generate">
          </div>
          <div class="form-group">
            <label for="mayday_mmsi">MMSI</label>
            <input type="text" id="mayday_mmsi" placeholder="e.g. 232123456">
          </div>
        </fieldset>
        <fieldset class="form-section">
          <legend>People</legend>
          <div class="form-group">
            <label for="mayday_persons_on_board">Persons on board</label>
            <input type="number" id="mayday_persons_on_board" min="0" step="1" placeholder="e.g. 4">
          </div>
          <div class="form-group">
            <label for="mayday_skipper_name">Skipper name</label>
            <input type="text" id="mayday_skipper_name" placeholder="Skipper name">
          </div>
          <div class="form-group">
            <label for="mayday_skipper_mobile">Skipper mobile</label>
            <input type="tel" id="mayday_skipper_mobile" placeholder="+44 ...">
          </div>
          <div class="form-group">
            <label for="mayday_emergency_contact_name">Emergency contact name</label>
            <input type="text" id="mayday_emergency_contact_name" placeholder="Shore contact">
          </div>
          <div class="form-group">
            <label for="mayday_emergency_contact_phone">Emergency contact phone</label>
            <input type="tel" id="mayday_emergency_contact_phone" placeholder="+44 ...">
          </div>
        </fieldset>
        <fieldset class="form-section">
          <legend>Vessel description</legend>
          <div class="form-group">
            <label for="mayday_vessel_type">Vessel type</label>
            <input type="text" id="mayday_vessel_type" placeholder="e.g. motor yacht, sailing yacht, RIB">
          </div>
          <div class="form-group">
            <label for="mayday_hull_colour">Hull colour</label>
            <input type="text" id="mayday_hull_colour" placeholder="e.g. white, blue">
          </div>
          <div class="form-group">
            <label for="mayday_length_m">Length (m)</label>
            <input type="number" id="mayday_length_m" min="0" step="0.01" placeholder="e.g. 10.5">
          </div>
          <div class="form-group">
            <label for="mayday_distinguishing_features">Distinguishing features</label>
            <textarea id="mayday_distinguishing_features" rows="2" placeholder="e.g. blue stripe, flybridge"></textarea>
          </div>
        </fieldset>
        <fieldset class="form-section">
          <legend>Equipment</legend>
          <div class="form-group">
            <label class="checkbox-row"><input type="checkbox" id="mayday_liferaft"><span>Liferaft</span></label>
          </div>
          <div class="form-group">
            <label class="checkbox-row"><input type="checkbox" id="mayday_epirb"><span>EPIRB</span></label>
          </div>
          <div class="form-group">
            <label for="mayday_epirb_hex_id">EPIRB hex ID</label>
            <input type="text" id="mayday_epirb_hex_id" placeholder="e.g. 1D0A2B3C4">
          </div>
          <div class="form-group">
            <label class="checkbox-row"><input type="checkbox" id="mayday_plb"><span>PLB</span></label>
          </div>
          <div class="form-group">
            <label class="checkbox-row"><input type="checkbox" id="mayday_ais"><span>AIS</span></label>
          </div>
        </fieldset>
        <fieldset class="form-section">
          <legend>Operating area</legend>
          <div class="form-group">
            <label for="mayday_home_port">Home port</label>
            <input type="text" id="mayday_home_port" placeholder="e.g. Cowes">
          </div>
          <div class="form-group">
            <label for="mayday_usual_area">Usual area</label>
            <input type="text" id="mayday_usual_area" placeholder="e.g. Solent">
          </div>
        </fieldset>
        <div class="form-group">
          <label for="mayday_notes">Notes</label>
          <textarea id="mayday_notes" rows="2" placeholder="Any other relevant info"></textarea>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" id="mayday-save-btn">Save</button>
        </div>
      </form>
    </div>
  `;

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

function fillSetupForm(d, boatData) {
  const boatName = boatData?.boat_name || '';
  const vesselNameEl = document.getElementById('mayday_vessel_name');
  if (vesselNameEl) vesselNameEl.value = (d && d.vessel_name) || boatName || '';
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };
  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!val;
  };
  if (d) {
    set('mayday_vessel_name_phonetic', d.vessel_name_phonetic);
    set('mayday_callsign', d.callsign ?? boatData?.vhf_callsign ?? '');
    set('mayday_callsign_phonetic', d.callsign_phonetic);
    set('mayday_mmsi', d.mmsi ?? boatData?.vhf_mmsi ?? '');
    set('mayday_persons_on_board', d.persons_on_board);
    set('mayday_skipper_name', d.skipper_name);
    set('mayday_skipper_mobile', d.skipper_mobile);
    set('mayday_emergency_contact_name', d.emergency_contact_name);
    set('mayday_emergency_contact_phone', d.emergency_contact_phone);
    set('mayday_vessel_type', d.vessel_type);
    set('mayday_hull_colour', d.hull_colour);
    set('mayday_length_m', d.length_m);
    set('mayday_distinguishing_features', d.distinguishing_features);
    setCheck('mayday_liferaft', d.liferaft);
    setCheck('mayday_epirb', d.epirb);
    set('mayday_epirb_hex_id', d.epirb_hex_id);
    setCheck('mayday_plb', d.plb);
    setCheck('mayday_ais', d.ais);
    set('mayday_home_port', d.home_port ?? boatData?.home_port ?? '');
    set('mayday_usual_area', d.usual_area);
    set('mayday_notes', d.notes);
  } else {
    set('mayday_callsign', boatData?.vhf_callsign ?? '');
    set('mayday_mmsi', boatData?.vhf_mmsi ?? '');
    set('mayday_home_port', boatData?.home_port ?? '');
  }
}

/** Build a distress-info-shaped object from current form values (used when no saved data / 404). */
function getInfoFromForm() {
  const num = (id) => {
    const v = document.getElementById(id)?.value;
    return v === '' || v == null ? null : (id === 'mayday_persons_on_board' ? parseInt(v, 10) : parseFloat(v));
  };
  const str = (id) => document.getElementById(id)?.value?.trim() || null;
  const chk = (id) => document.getElementById(id)?.checked ?? null;
  return {
    vessel_name: str('mayday_vessel_name') || '',
    vessel_name_phonetic: str('mayday_vessel_name_phonetic'),
    callsign: str('mayday_callsign'),
    callsign_phonetic: str('mayday_callsign_phonetic'),
    mmsi: str('mayday_mmsi'),
    persons_on_board: num('mayday_persons_on_board'),
    vessel_type: str('mayday_vessel_type'),
    hull_colour: str('mayday_hull_colour'),
    length_m: num('mayday_length_m'),
    liferaft: chk('mayday_liferaft'),
    epirb: chk('mayday_epirb'),
    epirb_hex_id: str('mayday_epirb_hex_id'),
    plb: chk('mayday_plb'),
    ais: chk('mayday_ais')
  };
}

function getNatureLabel(value) {
  const n = DISTRESS_NATURES.find((x) => x.value === value);
  return n ? n.label : value || '';
}

function updateScriptDisplay(scriptType) {
  const pre = document.getElementById('mayday-script-text');
  if (!pre) return;
  const dataSource = distressInfo || getInfoFromForm();
  const info = getDistressInfoForScript(dataSource);
  const positionEl = document.getElementById('mayday_incident_position');
  const natureEl = document.getElementById('mayday_incident_nature');
  const notesEl = document.getElementById('mayday_incident_notes');
  const positionText = positionEl ? positionEl.value : incidentPosition;
  const natureVal = natureEl ? natureEl.value : incidentNature;
  const natureText = getNatureLabel(natureVal);
  const notesText = notesEl ? notesEl.value : incidentNotes;
  const lines = buildScript(scriptType, info, boat?.boat_name, positionText, natureText, notesText);
  pre.innerHTML = lines.map((line, i) => `<span class="script-line"><span class="script-line-num">${i + 1}.</span> ${escapeHtml(line)}</span>`).join('\n');
}

function setActiveTab(scriptType) {
  document.querySelectorAll('.script-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.getAttribute('data-script') === scriptType);
  });
  updateScriptDisplay(scriptType);
}

async function loadData() {
  if (!currentBoatId) return;
  boat = await getBoat(currentBoatId);
  distressInfo = await getBoatDistressInfo(currentBoatId);
  fillSetupForm(distressInfo, boat);

  const scriptCard = document.getElementById('mayday-script-card');
  if (scriptCard) scriptCard.style.display = 'block';
  setActiveTab('mayday');
}

async function saveSetup(e) {
  e.preventDefault();
  if (!currentBoatId || maydayArchived) return;
  const vesselName = document.getElementById('mayday_vessel_name')?.value?.trim();
  if (!vesselName) {
    showToast('Vessel name is required.', 'error');
    return;
  }
  const form = e.target;
  setSaveButtonLoading(form, true);
  try {
  const payload = {
    vessel_name: vesselName,
    vessel_name_phonetic: document.getElementById('mayday_vessel_name_phonetic')?.value || null,
    callsign: document.getElementById('mayday_callsign')?.value || null,
    callsign_phonetic: document.getElementById('mayday_callsign_phonetic')?.value || null,
    mmsi: document.getElementById('mayday_mmsi')?.value || null,
    persons_on_board: document.getElementById('mayday_persons_on_board')?.value ? parseInt(document.getElementById('mayday_persons_on_board').value, 10) : null,
    skipper_name: document.getElementById('mayday_skipper_name')?.value || null,
    skipper_mobile: document.getElementById('mayday_skipper_mobile')?.value || null,
    emergency_contact_name: document.getElementById('mayday_emergency_contact_name')?.value || null,
    emergency_contact_phone: document.getElementById('mayday_emergency_contact_phone')?.value || null,
    vessel_type: document.getElementById('mayday_vessel_type')?.value || null,
    hull_colour: document.getElementById('mayday_hull_colour')?.value || null,
    length_m: document.getElementById('mayday_length_m')?.value ? parseFloat(document.getElementById('mayday_length_m').value) : null,
    distinguishing_features: document.getElementById('mayday_distinguishing_features')?.value || null,
    liferaft: document.getElementById('mayday_liferaft')?.checked ?? null,
    epirb: document.getElementById('mayday_epirb')?.checked ?? null,
    epirb_hex_id: document.getElementById('mayday_epirb_hex_id')?.value || null,
    plb: document.getElementById('mayday_plb')?.checked ?? null,
    ais: document.getElementById('mayday_ais')?.checked ?? null,
    home_port: document.getElementById('mayday_home_port')?.value || null,
    usual_area: document.getElementById('mayday_usual_area')?.value || null,
    notes: document.getElementById('mayday_notes')?.value || null
  };
  const result = await upsertBoatDistressInfo(currentBoatId, payload);
  if (result && !result.error) {
    await loadData();
    updateScriptDisplay(document.querySelector('.script-tab.active')?.getAttribute('data-script') || 'mayday');
  } else if (result?.error === 'vessel_name_required') {
    showToast('Vessel name is required.', 'error');
  } else if (!result || result.error) {
    showToast('Could not save to cloud. Run the boat_distress_info migration if needed. You can still use the script and copy it.', 'error');
    updateScriptDisplay(document.querySelector('.script-tab.active')?.getAttribute('data-script') || 'mayday');
  }
  } finally {
    setSaveButtonLoading(form, false);
  }
}

function getScriptPlainText() {
  const activeTab = document.querySelector('.script-tab.active');
  const scriptType = activeTab ? activeTab.getAttribute('data-script') : 'mayday';
  const dataSource = distressInfo || getInfoFromForm();
  const info = getDistressInfoForScript(dataSource);
  const positionEl = document.getElementById('mayday_incident_position');
  const natureEl = document.getElementById('mayday_incident_nature');
  const notesEl = document.getElementById('mayday_incident_notes');
  const positionText = positionEl ? positionEl.value : '';
  const natureText = getNatureLabel(natureEl ? natureEl.value : '');
  const notesText = notesEl ? notesEl.value : '';
  const lines = buildScript(scriptType, info, boat?.boat_name, positionText, natureText, notesText);
  return lines.join('\n');
}

function copyMaydayScript() {
  const text = getScriptPlainText();
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('mayday-copy-btn-top');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
  }).catch(() => showToast('Could not copy to clipboard.', 'error'));
}

function readMaydayScript() {
  const pre = document.getElementById('mayday-script-text');
  if (pre) pre.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if ('speechSynthesis' in window && speechSynthesis.speaking) {
    speechSynthesis.cancel();
    showToast('Stopped.', 'info');
    return;
  }
  const text = getScriptPlainText();
  if (!text) return;
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    u.pitch = 1;
    speechSynthesis.speak(u);
    showToast('Reading script aloud. Tap Read script again to stop.', 'info');
  } else {
    showToast('Your device does not support reading aloud.', 'info');
  }
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  if (boatId) currentBoatId = boatId;

  maydayArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;
  const saveBtn = document.getElementById('mayday-save-btn');
  if (maydayArchived && saveBtn) saveBtn.style.display = 'none';

  await loadData();

  const form = document.getElementById('mayday-setup-form');
  if (form) {
    form.addEventListener('submit', (e) => saveSetup(e));
    form.addEventListener('input', () => updateScriptDisplay(document.querySelector('.script-tab.active')?.getAttribute('data-script') || 'mayday'));
    form.addEventListener('change', () => updateScriptDisplay(document.querySelector('.script-tab.active')?.getAttribute('data-script') || 'mayday'));
  }

  document.querySelectorAll('.script-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const scriptType = tab.getAttribute('data-script');
      setActiveTab(scriptType);
    });
  });

  const positionEl = document.getElementById('mayday_incident_position');
  const natureEl = document.getElementById('mayday_incident_nature');
  const notesEl = document.getElementById('mayday_incident_notes');
  if (positionEl) positionEl.addEventListener('input', () => updateScriptDisplay(document.querySelector('.script-tab.active')?.getAttribute('data-script') || 'mayday'));
  if (natureEl) natureEl.addEventListener('change', () => updateScriptDisplay(document.querySelector('.script-tab.active')?.getAttribute('data-script') || 'mayday'));
  if (notesEl) notesEl.addEventListener('input', () => updateScriptDisplay(document.querySelector('.script-tab.active')?.getAttribute('data-script') || 'mayday'));

  const copyBtn = document.getElementById('mayday-copy-btn-top');
  if (copyBtn) copyBtn.addEventListener('click', copyMaydayScript);

  const readBtn = document.getElementById('mayday-read-btn');
  if (readBtn) readBtn.addEventListener('click', readMaydayScript);

  window.navigate = navigate;
}

export default {
  render,
  onMount
};
