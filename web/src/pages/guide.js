/**
 * Boat Dashboard Guide Page
 * Explains what each dashboard card does for the current boat.
 * Section order and colours match the dashboard cards.
 */

import { createYachtHeader, createBackButton } from '../components/header.js';
import { boatsStorage } from '../lib/storage.js';

let currentBoatId = null;

export function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  const boat = currentBoatId ? boatsStorage.get(currentBoatId) || {} : null;
  const fromHome = !currentBoatId;

  const wrapper = document.createElement('div');

  const yachtHeader = createYachtHeader('User Guide');
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-guide';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  const headerBlock = document.createElement('div');
  headerBlock.className = 'page-header';
  headerBlock.innerHTML = fromHome
    ? `
    <h2>BoatMatey user guide</h2>
    <p class="text-muted">
      This page explains what each section of BoatMatey does. From the home screen you can open
      Calendar &amp; Alerts, Settings, or tap a boat to see its dashboard. You can open this guide
      anytime from the &quot;User Guide&quot; card on the home page or from a boat&apos;s dashboard.
    </p>
  `
    : `
    <h2>Boat dashboard guide</h2>
    <p class="text-muted">
      This page explains what each tile on your boat dashboard does and when you might use it.
      You can always come back here by tapping the &quot;User Guide&quot; card.
    </p>
  `;

  const guideBody = document.createElement('div');
  guideBody.innerHTML = `
    <div class="card guide-section guide-section-boat">
      <h3>Boat Details</h3>
      <p>
        Store the core profile for this boat: name, make &amp; model, type (motor or sailing), photo, dimensions,
        fuel type, home marina, registration, insurance and purchase date. You can also record whether a
        <strong>watermaker</strong> is installed; when enabled, a Watermaker Service card appears on the dashboard.
        Start here after adding a new boat so other sections have the right context. Attach documents such as
        registration or insurance certificates.
      </p>
    </div>

    <div class="card guide-section guide-section-engines">
      <h3>Engines</h3>
      <p>
        Add each engine or drive on this boat with position (e.g. port/starboard), make, model, serial number
        and hours. For sailing boats you can still record an auxiliary engine. Service entries, DIY checklists
        and many reminders link back to these engine records so you always know which unit was serviced.
      </p>
    </div>

    <div class="card guide-section guide-section-service">
      <h3>Service History</h3>
      <p>
        Log every engine or gearbox service here—whether DIY or done by a mechanic. For DIY you can tick through
        a structured checklist (oil, filters, cooling, belts, electrical, etc.) tailored to fuel and drive type.
        You can also record Sails &amp; Rigging or Watermaker service. Attach invoices, worksheets and photos,
        and set reminders for the next service due.
      </p>
    </div>

    <div class="card guide-section guide-section-watermaker">
      <h3>Watermaker Service</h3>
      <p>
        <em>This card only appears on the dashboard when &quot;Watermaker installed&quot; is turned on in Boat Details.</em>
        Record your unit details (make, model, location, rated output, serial number) and add multiple service
        entries—each with date, tasks completed (pre-filters, carbon filter, membrane flush, pump oil), notes and
        optional <strong>next service due date</strong>. When you set a next service due date, a reminder is added
        to the Calendar 1 day before. Edit or delete any service entry from the list.
      </p>
    </div>

    <div class="card guide-section guide-section-haulout">
      <h3>Haul-Out Maintenance</h3>
      <p>
        Record work done when the boat is out of the water: antifoul (brand, type, coats), anodes, props,
        shaft, cutless bearings, rudder and steering, seacocks, hull condition and osmosis checks. Store
        which yard or contractor was used, costs and general notes. Set when the next haul-out is due and
        get reminders so you can plan ahead.
      </p>
    </div>

    <div class="card guide-section guide-section-sails-rigging">
      <h3>Sails &amp; Rigging</h3>
      <p>
        <em>This card only appears when the boat type is set to Sailing in Boat Details (or when adding the boat).</em>
        Record details of your mainsail, headsails, mast and spar, standing and running rigging, and winches.
        Note last inspection date and use this as a single place for sail and rigging notes. In Service History
        you can also log Sails &amp; Rigging services with a dedicated checklist (mainsail, headsails, mast,
        shrouds, halyards, winches, etc.).
      </p>
    </div>

    <div class="card guide-section guide-section-navigation">
      <h3>Navigation Equipment</h3>
      <p>
        Keep a register of plotters, radar, AIS, autopilot and other nav gear for this boat. Store make,
        model, serial numbers, install and warranty dates, and attach manuals or wiring diagrams for quick
        reference. Set warranty reminders so you don&apos;t miss expiry dates.
      </p>
    </div>

    <div class="card guide-section guide-section-safety">
      <h3>Safety Equipment</h3>
      <p>
        Track lifejackets, liferafts, flares, EPIRBs and other safety kit. Record type, serial numbers,
        service intervals and where each item lives on board. Store expiry dates and inspection due dates
        so you can see at a glance what needs attention and get reminders before items expire.
      </p>
    </div>

    <div class="card guide-section guide-section-log">
      <h3>Ship&apos;s Log</h3>
      <p>
        Record trips and passages: dates, departure and arrival, engine hours, distance and notes. Over time
        this builds a simple logbook for the boat that you can refer back to when planning future cruises
        or when selling or surveying the boat.
      </p>
    </div>

    <div class="card guide-section guide-section-links">
      <h3>Web Links</h3>
      <p>
        Save links that are useful for this boat—manuals, parts diagrams, marina portals or favourite
        weather sites. Everything stays together with the rest of your boat records so you can open them
        quickly from one place.
      </p>
    </div>

    <div class="card guide-section guide-section-calendar">
      <h3>Calendar &amp; Alerts</h3>
      <p>
        Accessible from the home page (not the boat dashboard). The calendar shows reminders from all your
        boats—warranties, next service, next haul-out—alongside your own appointments. You can choose which
        boat each appointment belongs to and set reminders so you never miss an important date.
      </p>
    </div>

    <div class="card guide-section guide-section-account">
      <h3>Settings</h3>
      <p>
        Also on the home page. Manage account-level settings such as your BoatMatey subscription and
        sign-in details. This is shared across all boats, not just the one you are viewing.
      </p>
    </div>

    <div class="card guide-section guide-section-guide">
      <h3>User Guide</h3>
      <p>
        You&apos;re here. The User Guide card opens this page so you can quickly remind yourself what each
        section is for and how to get the most out of your boat records.
      </p>
    </div>

    <div class="card guide-section guide-section-tips">
      <h3>Tips for using the dashboard</h3>
      <ul>
        <li>Tap any tile to open that section for the current boat.</li>
        <li>Most sections let you attach photos, PDFs or links so everything lives in one place.</li>
        <li>Use the Calendar &amp; Alerts card (on the home screen) to keep on top of time-based reminders from engines, service, haul-outs and warranties.</li>
        <li>Turn on &quot;Watermaker installed&quot; in Boat Details to show the Watermaker Service card; set boat type to Sailing to see the Sails &amp; Rigging card.</li>
      </ul>
    </div>
  `;

  container.appendChild(headerBlock);
  container.appendChild(guideBody);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

export default {
  render
};
