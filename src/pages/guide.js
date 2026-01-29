/**
 * Boat Dashboard Guide Page
 * Explains what each dashboard card does for the current boat.
 */

import { navigate } from '../router.js';
import { createYachtHeader } from '../components/header.js';

let currentBoatId = null;

export function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  if (!currentBoatId) {
    const wrapperError = document.createElement('div');
    wrapperError.innerHTML =
      '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapperError;
  }

  const wrapper = document.createElement('div');

  const yachtHeader = createYachtHeader('Guide', true, () => navigate(`/boat/${currentBoatId}`));
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-guide';

  const container = document.createElement('div');
  container.className = 'container';

  const headerBlock = document.createElement('div');
  headerBlock.className = 'page-header';
  headerBlock.innerHTML = `
    <h2>Boat dashboard guide</h2>
    <p class="text-muted">
      This page explains what each tile on your boat dashboard does and when you might use it.
      You can always come back here by tapping the "Guide" card.
    </p>
  `;

  const guideBody = document.createElement('div');
  guideBody.innerHTML = `
    <div class="card">
      <h3>Boat Details</h3>
      <p>
        Store the core profile for this boat: name, make & model, photo and key details.
        Start here after adding a new boat so other sections have the right context.
      </p>
    </div>

    <div class="card">
      <h3>Engines</h3>
      <p>
        Add each engine (or drive) on this boat, with serial numbers, hours and gearbox details.
        Service entries, warranties and many reminders link back to these engine records.
      </p>
    </div>

    <div class="card">
      <h3>Service History</h3>
      <p>
        Log every engine or gearbox service here – whether DIY or done by a mechanic.
        You can attach invoices, worksheets and photos, and (for DIY) tick through a structured checklist.
      </p>
    </div>

    <div class="card">
      <h3>Haul-Out Maintenance</h3>
      <p>
        Record work done when the boat is out of the water: antifoul, anodes, props, through-hulls and underwater gear.
        Use it to track which yard you used, what was done, and when the next haul-out is due.
      </p>
    </div>

    <div class="card">
      <h3>Navigation Equipment</h3>
      <p>
        Keep a register of plotters, radar, AIS, autopilot and other nav gear.
        Store serial numbers, warranty dates and attach manuals or wiring diagrams for quick reference.
      </p>
    </div>

    <div class="card">
      <h3>Safety Equipment</h3>
      <p>
        Track lifejackets, liferafts, flares, EPIRBs and other safety kit.
        Record where each item lives on board and when inspections or replacements are due.
      </p>
    </div>

    <div class="card">
      <h3>Ship's Log</h3>
      <p>
        Record trips and passages: dates, routes, conditions and notes.
        Over time this builds a simple logbook for the boat, which you can refer back to when planning future cruises.
      </p>
    </div>

    <div class="card">
      <h3>Calendar & Alerts</h3>
      <p>
        See upcoming reminders (like warranties and next service dates) alongside your own appointments.
        You can also export items as calendar (.ics) files to your phone or tablet’s calendar app.
      </p>
    </div>

    <div class="card">
      <h3>Web Links</h3>
      <p>
        Save links that are useful for this boat – manuals, parts diagrams, marina portals or favourite weather sites.
        Everything stays together with the rest of your boat records.
      </p>
    </div>

    <div class="card">
      <h3>Admin</h3>
      <p>
        Manage account-level settings such as your BoatMatey subscription and sign-in details.
        This is shared across all boats, not just the one you are viewing.
      </p>
    </div>

    <div class="card">
      <h3>Tips for using the dashboard</h3>
      <ul>
        <li>Tap any tile to open that section for the current boat.</li>
        <li>Most sections let you attach photos, PDFs or links so everything lives in one place.</li>
        <li>Use the Calendar & Alerts card to keep on top of time-based reminders from engines, service and haul-outs.</li>
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

