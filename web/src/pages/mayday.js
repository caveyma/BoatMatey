/**
 * Mayday / Distress Call Page
 * Fresh fetch from Supabase on every entry. Setup form + VHF script (MAYDAY, PAN-PAN, SÉCURITÉ).
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { getBoat, getBoatDistressInfo, upsertBoatDistressInfo, isBoatArchived } from '../lib/dataService.js';
import { getVesselNamePhonetic, getCallsignPhonetic } from '../lib/phonetic.js';

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
  lines.push(`This is ${info.vesselName} ${info.vesselName} ${info.vesselName}.`);
  if (info.vesselPhonetic) {
    lines.push(`Spelling: ${info.vesselPhonetic}`);
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
  if (extras.length) lines.push(extras.join(' '));
  if (incidentNotesText && incidentNotesText.trim()) {
    lines.push(incidentNotesText.trim());
  }
  lines.push('Over.');
  return lines.filter(Boolean).join('\n');
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

    <div class="card" id="mayday-script-card" style="display: none;">
      <h3>Quick script</h3>
      <div class="script-tabs">
        <button type="button" class="script-tab active" data-script="mayday">MAYDAY</button>
        <button type="button" class="script-tab" data-script="panpan">PAN-PAN</button>
        <button type="button" class="script-tab" data-script="securite">SÉCURITÉ</button>
      </div>
      <div class="script-content">
        <pre id="mayday-script-text" class="script-text"></pre>
      </div>
      <p class="script-reminder">Say the message 3 times. Stay on channel 16 unless instructed otherwise.</p>
    </div>

    <div class="card" id="mayday-incident-card">
      <h3>At the moment (for this incident)</h3>
      <p class="text-muted">Fill in now; not saved unless you save vessel details above with the same text.</p>
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
      <div class="form-actions">
        <button type="button" class="btn-primary" id="mayday-copy-btn">Copy MAYDAY script</button>
      </div>
    </div>
  `;

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);
  return wrapper;
}

function fillSetupForm(d, boatName) {
  const vesselName = document.getElementById('mayday_vessel_name');
  if (vesselName) vesselName.value = (d && d.vessel_name) || boatName || '';
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
    set('mayday_callsign', d.callsign);
    set('mayday_callsign_phonetic', d.callsign_phonetic);
    set('mayday_mmsi', d.mmsi);
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
    set('mayday_home_port', d.home_port);
    set('mayday_usual_area', d.usual_area);
    set('mayday_notes', d.notes);
  }
}

function getNatureLabel(value) {
  const n = DISTRESS_NATURES.find((x) => x.value === value);
  return n ? n.label : value || '';
}

function updateScriptDisplay(scriptType) {
  const pre = document.getElementById('mayday-script-text');
  if (!pre) return;
  const info = getDistressInfoForScript(distressInfo);
  const positionEl = document.getElementById('mayday_incident_position');
  const natureEl = document.getElementById('mayday_incident_nature');
  const notesEl = document.getElementById('mayday_incident_notes');
  const positionText = positionEl ? positionEl.value : incidentPosition;
  const natureVal = natureEl ? natureEl.value : incidentNature;
  const natureText = getNatureLabel(natureVal);
  const notesText = notesEl ? notesEl.value : incidentNotes;
  const text = buildScript(scriptType, info, boat?.boat_name, positionText, natureText, notesText);
  pre.textContent = text;
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
  const boatName = boat?.boat_name || '';
  fillSetupForm(distressInfo, boatName);

  const scriptCard = document.getElementById('mayday-script-card');
  if (scriptCard) {
    scriptCard.style.display = distressInfo ? 'block' : 'none';
  }
  if (distressInfo) {
    setActiveTab('mayday');
  }
}

async function saveSetup(e) {
  e.preventDefault();
  if (!currentBoatId || maydayArchived) return;
  const vesselName = document.getElementById('mayday_vessel_name')?.value?.trim();
  if (!vesselName) {
    alert('Vessel name is required.');
    return;
  }
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
    alert('Vessel name is required.');
  }
}

function copyMaydayScript() {
  const activeTab = document.querySelector('.script-tab.active');
  const scriptType = activeTab ? activeTab.getAttribute('data-script') : 'mayday';
  const info = getDistressInfoForScript(distressInfo);
  const positionEl = document.getElementById('mayday_incident_position');
  const natureEl = document.getElementById('mayday_incident_nature');
  const notesEl = document.getElementById('mayday_incident_notes');
  const positionText = positionEl ? positionEl.value : '';
  const natureText = getNatureLabel(natureEl ? natureEl.value : '');
  const notesText = notesEl ? notesEl.value : '';
  const text = buildScript(scriptType, info, boat?.boat_name, positionText, natureText, notesText);
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById('mayday-copy-btn');
    if (btn) {
      const orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    }
  }).catch(() => alert('Could not copy to clipboard.'));
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

  const copyBtn = document.getElementById('mayday-copy-btn');
  if (copyBtn) copyBtn.addEventListener('click', copyMaydayScript);

  window.navigate = navigate;
}

export default {
  render,
  onMount
};
