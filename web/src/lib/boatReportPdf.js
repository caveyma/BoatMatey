/**
 * PDF report generation for complete boat export.
 * Produces a single professional PDF with all boat-related sections.
 */

import { jsPDF } from 'jspdf';

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;
const SECTION_GAP = 10;
const HEADING_SIZE = 12;
const BODY_SIZE = 10;
const LABEL_SIZE = 9;

/**
 * @typedef {Object} BoatExportData
 * @property {Object|null} boat
 * @property {Object} sections
 * @property {Array} sections.engines
 * @property {Array} sections.serviceHistory
 * @property {Array} sections.navigationEquipment
 * @property {Array} sections.safetyEquipment
 * @property {Array} sections.logbook
 * @property {Array} sections.haulouts
 * @property {Array} sections.links
 * @property {Array} sections.projects
 * @property {Array} sections.inventory
 * @property {Object|null} sections.fuelPerformance
 * @property {Array} sections.fuelLogs
 * @property {Array} sections.batteries
 * @property {Object|null} sections.boatElectrical
 * @property {Object|null} sections.distressInfo
 * @property {Array} sections.calendarEvents
 */

/**
 * @param {jsPDF} doc
 * @param {string} text
 * @param {number} y
 * @param {number} [maxWidth]
 * @returns {number} new y position
 */
function addWrappedText(doc, text, y, maxWidth = CONTENT_WIDTH) {
  if (text == null || text === '') return y;
  const lines = doc.splitTextToSize(String(text), maxWidth);
  doc.text(lines, MARGIN, y);
  return y + lines.length * LINE_HEIGHT;
}

/**
 * @param {jsPDF} doc
 * @param {number} y
 * @returns {{ y: number, newPage: boolean }}
 */
function ensureSpace(doc, y, needLines = 5) {
  if (y + needLines * LINE_HEIGHT > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    return { y: MARGIN, newPage: true };
  }
  return { y, newPage: false };
}

/**
 * @param {jsPDF} doc
 * @param {string} heading
 * @param {number} y
 * @returns {number}
 */
function addSectionHeading(doc, heading, y) {
  const { y: newY } = ensureSpace(doc, y, 4);
  let currentY = newY;
  doc.setFontSize(HEADING_SIZE);
  doc.setFont('helvetica', 'bold');
  doc.text(heading, MARGIN, currentY);
  currentY += LINE_HEIGHT + 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_SIZE);
  return currentY;
}

function addLabelValue(doc, label, value, y) {
  if (value == null || value === '') return y;
  const { y: newY } = ensureSpace(doc, y, 2);
  let currentY = newY;
  doc.setFontSize(LABEL_SIZE);
  doc.setFont('helvetica', 'bold');
  doc.text(`${label}: `, MARGIN, currentY);
  const labelW = doc.getTextWidth(`${label}: `);
  doc.setFont('helvetica', 'normal');
  const valStr = String(value);
  const lines = doc.splitTextToSize(valStr, CONTENT_WIDTH - labelW - 2);
  doc.text(lines, MARGIN + labelW, currentY);
  currentY += lines.length * LINE_HEIGHT;
  return currentY;
}

/**
 * @param {BoatExportData} data
 * @param {{ generatedDate?: string, accountName?: string }} [options]
 * @returns {Uint8Array}
 */
export function buildPdfReport(data, options = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const generatedDate = options.generatedDate || new Date().toLocaleDateString(undefined, { dateStyle: 'long' });
  const accountName = options.accountName || '';

  let y = MARGIN;

  // Cover / header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BoatMatey', MARGIN, y);
  y += LINE_HEIGHT + 4;
  doc.setFontSize(14);
  doc.text('Boat Report', MARGIN, y);
  y += LINE_HEIGHT + 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(BODY_SIZE);

  const boat = data.boat;
  const boatName = boat?.boat_name || 'Unknown boat';
  doc.setFont('helvetica', 'bold');
  doc.text(boatName, MARGIN, y);
  y += LINE_HEIGHT;
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${generatedDate}`, MARGIN, y);
  y += LINE_HEIGHT;
  if (accountName) {
    doc.text(`Account: ${accountName}`, MARGIN, y);
    y += LINE_HEIGHT;
  }
  doc.text('Complete vessel record', MARGIN, y);
  y += LINE_HEIGHT + SECTION_GAP;

  const sections = data.sections || {};

  // Boat Details
  y = addSectionHeading(doc, 'Boat Details', y);
  if (boat) {
    y = addLabelValue(doc, 'Name', boat.boat_name, y);
    y = addLabelValue(doc, 'Type', boat.boat_type, y);
    y = addLabelValue(doc, 'Make & Model', boat.make_model, y);
    y = addLabelValue(doc, 'Year', boat.year, y);
    y = addLabelValue(doc, 'Hull ID / CIN', boat.hull_id, y);
    y = addLabelValue(doc, 'Length (m)', boat.length, y);
    y = addLabelValue(doc, 'Beam (m)', boat.beam, y);
    y = addLabelValue(doc, 'Draft (m)', boat.draft, y);
    y = addLabelValue(doc, 'Home Port', boat.home_port, y);
    y = addLabelValue(doc, 'Registration Number', boat.registration_number, y);
    y = addLabelValue(doc, 'SSR Number', boat.ssr_number, y);
    y = addLabelValue(doc, 'VHF Callsign', boat.vhf_callsign, y);
    y = addLabelValue(doc, 'VHF MMSI', boat.vhf_mmsi, y);
    y = addLabelValue(doc, 'Last Survey Date', boat.last_survey_date, y);
    y = addLabelValue(doc, 'Last Surveyor', boat.last_surveyor, y);
    y = addLabelValue(doc, 'Home Marina', boat.home_marina, y);
    y = addLabelValue(doc, 'Insurance Provider', boat.insurance_provider, y);
    y = addLabelValue(doc, 'Insurance Policy Number', boat.insurance_policy_no, y);
    y = addLabelValue(doc, 'Purchase Date', boat.purchase_date, y);
    y = addLabelValue(doc, 'Fuel Type', boat.fuel_type, y);
  } else {
    y = addWrappedText(doc, 'No boat data.', y);
  }
  y += SECTION_GAP;

  // Engines
  const engines = sections.engines || [];
  if (engines.length > 0) {
    y = addSectionHeading(doc, 'Engines', y);
    engines.forEach((e, i) => {
      const { y: newY } = ensureSpace(doc, y, 8);
      y = newY;
      const engineLabel = e.label || e.name || e.make_model || [e.manufacturer, e.model].filter(Boolean).join(' ') || 'Unnamed';
      doc.setFont('helvetica', 'bold');
      doc.text(`Engine ${i + 1}: ${engineLabel}`, MARGIN, y);
      y += LINE_HEIGHT;
      doc.setFont('helvetica', 'normal');
      y = addLabelValue(doc, 'Make/Model', e.make_model || e.manufacturer || (e.make && e.model ? `${e.make} ${e.model}` : e.make || e.model), y);
      y = addLabelValue(doc, 'Type', e.engine_type, y);
      y = addLabelValue(doc, 'Hours', e.hours, y);
      y = addLabelValue(doc, 'Serial Number', e.serial_number || e.serial, y);
      y = addLabelValue(doc, 'Notes', e.notes, y);
      y += 2;
    });
    y += SECTION_GAP;
  }

  // Service History
  const serviceHistory = sections.serviceHistory || [];
  if (serviceHistory.length > 0) {
    y = addSectionHeading(doc, 'Service History', y);
    serviceHistory.forEach((s, i) => {
      const { y: newY } = ensureSpace(doc, y, 6);
      y = newY;
      doc.text(`${s.date || s.service_date || '—'} · ${s.service_type || s.title || 'Service'}`, MARGIN, y);
      y += LINE_HEIGHT;
      if (s.notes || s.description) y = addWrappedText(doc, s.notes || s.description, y);
      y += 2;
    });
    y += SECTION_GAP;
  }

  // Watermaker (from boat)
  if (boat?.watermaker_installed && boat.watermaker_data) {
    const wm = boat.watermaker_data;
    const unit = wm.unit || {};
    const services = Array.isArray(wm.services) ? wm.services : [];
    y = addSectionHeading(doc, 'Watermaker Service', y);
    y = addLabelValue(doc, 'Make/Model', unit.make_model, y);
    y = addLabelValue(doc, 'Location', unit.location, y);
    y = addLabelValue(doc, 'Capacity', unit.capacity, y);
    y = addLabelValue(doc, 'Serial Number', unit.serial_number, y);
    if (wm.next_service_due) y = addLabelValue(doc, 'Next service due', wm.next_service_due, y);
    if (services.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Service history', MARGIN, y);
      y += LINE_HEIGHT;
      doc.setFont('helvetica', 'normal');
      services.forEach((svc) => {
        const { y: newY } = ensureSpace(doc, y, 4);
        y = newY;
        doc.text(`${svc.date || '—'} ${svc.notes ? ': ' + svc.notes : ''}`, MARGIN, y);
        y += LINE_HEIGHT;
      });
    }
    y += SECTION_GAP;
  }

  // Fuel & Performance
  const fuelPerf = sections.fuelPerformance;
  const fuelLogs = sections.fuelLogs || [];
  if (fuelPerf || fuelLogs.length > 0) {
    y = addSectionHeading(doc, 'Fuel & Performance', y);
    if (fuelPerf) {
      y = addLabelValue(doc, 'Preferred units', fuelPerf.preferred_units, y);
      y = addLabelValue(doc, 'Typical cruise RPM', fuelPerf.typical_cruise_rpm, y);
      y = addLabelValue(doc, 'Typical cruise speed (kn)', fuelPerf.typical_cruise_speed_kn, y);
      y = addLabelValue(doc, 'Typical burn (l/h)', fuelPerf.typical_burn_lph, y);
      y = addLabelValue(doc, 'Fuel tank capacity (L)', fuelPerf.fuel_tank_capacity_litres, y);
      y = addLabelValue(doc, 'Usable fuel (L)', fuelPerf.usable_fuel_litres, y);
      y = addLabelValue(doc, 'Notes', fuelPerf.notes, y);
    }
    if (fuelLogs.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.text('Fuel logs', MARGIN, y);
      y += LINE_HEIGHT;
      doc.setFont('helvetica', 'normal');
      fuelLogs.slice(0, 30).forEach((log) => {
        const { y: newY } = ensureSpace(doc, y, 3);
        y = newY;
        const date = log.log_date || log.date || '—';
        const added = log.fuel_added_litres != null ? `${log.fuel_added_litres} L` : '';
        const hours = log.engine_hours != null ? `${log.engine_hours} h` : '';
        doc.text(`${date}  ${added}  ${hours}  ${log.notes || ''}`, MARGIN, y);
        y += LINE_HEIGHT;
      });
      if (fuelLogs.length > 30) doc.text(`… and ${fuelLogs.length - 30} more entries`, MARGIN, (y += LINE_HEIGHT));
    }
    y += SECTION_GAP;
  }

  // Electrical & Batteries
  const boatElectrical = sections.boatElectrical;
  const batteries = sections.batteries || [];
  if (boatElectrical || batteries.length > 0) {
    y = addSectionHeading(doc, 'Electrical & Batteries', y);
    if (boatElectrical) {
      y = addLabelValue(doc, 'System voltage', boatElectrical.system_voltage, y);
      y = addLabelValue(doc, 'Shore power', boatElectrical.shore_power, y);
      y = addLabelValue(doc, 'Inverter', boatElectrical.inverter, y);
      y = addLabelValue(doc, 'Charger brand', boatElectrical.charger_brand, y);
      y = addLabelValue(doc, 'Solar', boatElectrical.solar, y);
      y = addLabelValue(doc, 'Solar (W)', boatElectrical.solar_watts, y);
      y = addLabelValue(doc, 'Generator', boatElectrical.generator, y);
      y = addLabelValue(doc, 'Notes', boatElectrical.notes, y);
    }
    batteries.forEach((b, i) => {
      const { y: newY } = ensureSpace(doc, y, 5);
      y = newY;
      doc.text(`${b.battery_name || `Battery ${i + 1}`} · ${b.capacity_ah || '—'} Ah · Qty ${b.quantity ?? 1}`, MARGIN, y);
      y += LINE_HEIGHT;
      y = addLabelValue(doc, 'Type', b.battery_type, y);
      y = addLabelValue(doc, 'Installed', b.installed_date, y);
      y = addLabelValue(doc, 'Last test', b.last_test_date, y);
      y += 2;
    });
    y += SECTION_GAP;
  }

  // Mayday / Distress
  const distress = sections.distressInfo;
  if (distress) {
    y = addSectionHeading(doc, 'Mayday / Distress Call', y);
    y = addLabelValue(doc, 'Vessel name', distress.vessel_name, y);
    y = addLabelValue(doc, 'Callsign', distress.callsign, y);
    y = addLabelValue(doc, 'MMSI', distress.mmsi, y);
    y = addLabelValue(doc, 'Persons on board', distress.persons_on_board, y);
    y = addLabelValue(doc, 'Skipper', distress.skipper_name, y);
    y = addLabelValue(doc, 'Emergency contact', distress.emergency_contact_name, y);
    y = addLabelValue(doc, 'Emergency phone', distress.emergency_contact_phone, y);
    y += SECTION_GAP;
  }

  // Haul-out
  const haulouts = sections.haulouts || [];
  if (haulouts.length > 0) {
    y = addSectionHeading(doc, 'Haul-Out Maintenance', y);
    haulouts.forEach((h) => {
      const { y: newY } = ensureSpace(doc, y, 6);
      y = newY;
      doc.text(`${h.haulout_date || h.date || '—'} · ${h.yard_marina || h.yard_name || 'Haul-out'}`, MARGIN, y);
      y += LINE_HEIGHT;
      y = addLabelValue(doc, 'Next due', h.next_haulout_due || h.next_due_date, y);
      if (h.general_notes || h.notes) y = addWrappedText(doc, h.general_notes || h.notes, y);
      y += 2;
    });
    y += SECTION_GAP;
  }

  // Projects
  const projects = sections.projects || [];
  if (projects.length > 0) {
    y = addSectionHeading(doc, 'Projects', y);
    projects.forEach((p) => {
      const { y: newY } = ensureSpace(doc, y, 5);
      y = newY;
      doc.text(`${p.name || 'Project'} · ${p.status || '—'}`, MARGIN, y);
      y += LINE_HEIGHT;
      if (p.description) y = addWrappedText(doc, p.description, y);
      y += 2;
    });
    y += SECTION_GAP;
  }

  // Inventory
  const inventory = sections.inventory || [];
  if (inventory.length > 0) {
    y = addSectionHeading(doc, 'Inventory', y);
    inventory.forEach((item) => {
      const { y: newY } = ensureSpace(doc, y, 3);
      y = newY;
      const stock = item.in_stock_level != null && item.required_quantity != null ? ` (${item.in_stock_level}/${item.required_quantity})` : '';
      const critical = item.critical_spare ? ' [Critical]' : '';
      const cat = item.category ? ` [${item.category}]` : '';
      doc.text(`${item.name || 'Item'}${cat}${stock}${critical}`, MARGIN, y);
      y += LINE_HEIGHT;
      if (item.location) y = addLabelValue(doc, 'Location', item.location, y);
      if (item.notes) y = addWrappedText(doc, item.notes, y);
      y += 2;
    });
    y += SECTION_GAP;
  }

  // Sails & Rigging (from boat)
  if (boat?.boat_type === 'sailing' && boat.sails_rigging_data) {
    const sr = boat.sails_rigging_data;
    y = addSectionHeading(doc, 'Sails & Rigging', y);
    y = addLabelValue(doc, 'Mainsail', sr.mainsail_details, y);
    y = addLabelValue(doc, 'Headsails', sr.headsails_details, y);
    y = addLabelValue(doc, 'Mast & spar', sr.mast_spar_notes, y);
    y = addLabelValue(doc, 'Standing rigging', sr.standing_rigging_notes, y);
    y = addLabelValue(doc, 'Running rigging', sr.running_rigging_notes, y);
    y = addLabelValue(doc, 'Winches', sr.winches_notes, y);
    y = addLabelValue(doc, 'Last inspection', sr.last_inspection_date, y);
    y = addLabelValue(doc, 'Notes', sr.sails_rigging_notes, y);
    y += SECTION_GAP;
  }

  // Navigation Equipment
  const navEq = sections.navigationEquipment || [];
  if (navEq.length > 0) {
    y = addSectionHeading(doc, 'Navigation Equipment', y);
    navEq.forEach((n) => {
      const { y: newY } = ensureSpace(doc, y, 4);
      y = newY;
      doc.text(`${n.name || 'Item'} · ${n.type || ''}`, MARGIN, y);
      y += LINE_HEIGHT;
      y = addLabelValue(doc, 'Notes', n.notes, y);
      y += 2;
    });
    y += SECTION_GAP;
  }

  // Safety Equipment
  const safetyEq = sections.safetyEquipment || [];
  if (safetyEq.length > 0) {
    y = addSectionHeading(doc, 'Safety Equipment', y);
    safetyEq.forEach((s) => {
      const { y: newY } = ensureSpace(doc, y, 4);
      y = newY;
      doc.text(`${s.name || 'Item'} · ${s.type || ''}`, MARGIN, y);
      y += LINE_HEIGHT;
      y = addLabelValue(doc, 'Notes', s.notes, y);
      y += 2;
    });
    y += SECTION_GAP;
  }

  // Passage Log
  const logbook = sections.logbook || [];
  if (logbook.length > 0) {
    y = addSectionHeading(doc, 'Passage Log', y);
    logbook.slice(0, 50).forEach((entry) => {
      const { y: newY } = ensureSpace(doc, y, 4);
      y = newY;
      const from = entry.departure || entry.departure_port || entry.from_location || '—';
      const to = entry.arrival || entry.arrival_port || entry.to_location || '—';
      const date = entry.date || entry.trip_date || entry.departure_date || '—';
      doc.text(`${date}  ${from} → ${to}`, MARGIN, y);
      y += LINE_HEIGHT;
      const engines = entry.engine_hours_engines;
      if (Array.isArray(engines) && engines.length > 0) {
        engines.forEach((eng, i) => {
          const hasName = eng.label && String(eng.label).trim();
          const title = hasName ? `${eng.label.trim()} ` : engines.length > 1 ? `Engine ${i + 1} ` : '';
          const hs = eng.start != null ? String(eng.start) : '—';
          const he = eng.end != null ? String(eng.end) : '—';
          let line = `  ${title}${hs} → ${he}`;
          if (eng.start != null && eng.end != null) {
            line += ` (${(Number(eng.end) - Number(eng.start)).toFixed(1)} hrs used)`;
          }
          doc.text(line, MARGIN, y);
          y += LINE_HEIGHT;
        });
      } else if (entry.engine_hours_start != null || entry.engine_hours_end != null) {
        const hs = entry.engine_hours_start != null ? String(entry.engine_hours_start) : '—';
        const he = entry.engine_hours_end != null ? String(entry.engine_hours_end) : '—';
        let line = `  Engine hours: ${hs} → ${he}`;
        if (entry.engine_hours_start != null && entry.engine_hours_end != null) {
          line += ` (${(Number(entry.engine_hours_end) - Number(entry.engine_hours_start)).toFixed(1)} hrs used)`;
        }
        doc.text(line, MARGIN, y);
        y += LINE_HEIGHT;
      }
      const logNotes = entry.notes || (typeof entry.daily_notes === 'string' ? entry.daily_notes : null);
      if (logNotes) y = addWrappedText(doc, logNotes, y);
      y += 2;
    });
    if (logbook.length > 50) doc.text(`… and ${logbook.length - 50} more entries`, MARGIN, (y += LINE_HEIGHT));
    y += SECTION_GAP;
  }

  // Web Links
  const links = sections.links || [];
  if (links.length > 0) {
    y = addSectionHeading(doc, 'Web Links', y);
    links.forEach((l) => {
      const { y: newY } = ensureSpace(doc, y, 2);
      y = newY;
      doc.text(`${l.name || 'Link'}: ${l.url || ''}`, MARGIN, y);
      y += LINE_HEIGHT;
    });
    y += SECTION_GAP;
  }

  return doc.output('arraybuffer');
}
