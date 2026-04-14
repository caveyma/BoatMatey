/**
 * User Guide page (home or per-boat).
 * Explains dashboard sections in roughly the same order as the boat dashboard cards, with matching accent colours.
 */

import { createYachtHeader, createBackButton } from '../components/header.js';

export function render(params = {}) {
  const currentBoatId = params?.id || window.routeParams?.id;
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
      This guide explains every section of BoatMatey and how to use it. From the home screen you can open
      Calendar &amp; Alerts, Settings, or tap a boat to see its dashboard and module cards. Open this guide anytime from the
      &quot;User Guide&quot; card on the home page or from a boat&apos;s dashboard.
    </p>
  `
    : `
    <h2>Boat dashboard guide</h2>
    <p class="text-muted">
      What each tile does and how to use it for this boat. Return here anytime via the &quot;User Guide&quot; card.
    </p>
  `;

  const guideBody = document.createElement('div');
  guideBody.innerHTML = `
    <div class="card guide-section guide-section-boat">
      <h3>Boat Details</h3>
      <p><strong>What it is:</strong> The main profile for this boat—name, make &amp; model, <strong>boat type</strong> (motor, sailing or RIB), photo, dimensions, fuel type, home marina, registration, insurance and purchase date.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap the Boat Details card, then edit the form and tap <strong>Save</strong>.</li>
        <li>Set <strong>Boat type</strong> to <strong>Sailing</strong> if you have a sailboat—this shows the <strong>Sails &amp; Rigging</strong> card on the dashboard.</li>
        <li>Attach documents (e.g. registration, insurance) via the attachments area.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-sails-rigging">
      <h3>Sails &amp; Rigging</h3>
      <p><em>This card only appears when the boat type is set to <strong>Sailing</strong> in Boat Details.</em></p>
      <p><strong>What it is:</strong> A single form to record mainsail, headsails, mast and spar, standing and running rigging, winches, last inspection date and general notes. It does <strong>not</strong> log individual services—for that you use the <strong>Service History</strong> card and choose &quot;N/A – Sails &amp; Rigging&quot; and the Sails &amp; Rigging checklist. You can also maintain <strong>sail and rigging maintenance schedules</strong> here with optional calendar reminders.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Sails &amp; Rigging to view or edit the details form; tap <strong>Save</strong> when done.</li>
        <li>To record a sails/rigging <em>service</em>, use the <strong>Service History</strong> card and select &quot;N/A – Sails &amp; Rigging&quot; as the engine, then use the dedicated checklist.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-engines">
      <h3>Engines</h3>
      <p><strong>What it is:</strong> A list of every engine or drive on this boat. For each one you store position (e.g. port/starboard), make, model, serial number and hours. Sailing boats can still record an auxiliary engine. Service entries and reminders link to these records.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Engines, then <strong>Add engine</strong> to create a new entry.</li>
        <li>Fill in make, model, serial number, position and current hours.</li>
        <li>Open an engine to add <strong>maintenance schedules</strong> (planning layer with optional next due and calendar reminders), separate from individual service log lines in Service History.</li>
        <li>When logging a service in Service History, you choose which engine the service was for.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-service">
      <h3>Service History</h3>
      <p><strong>What it is:</strong> A log of every engine or gearbox service—DIY or done by a mechanic. For DIY you can use a checklist (oil, filters, cooling, belts, electrical, etc.) tailored to fuel and drive type. You can also log <strong>Sails &amp; Rigging</strong> or <strong>Watermaker</strong> service. Attach invoices and photos, and set reminders for the next service.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Service History, then <strong>Add service</strong>.</li>
        <li>Choose the engine (or &quot;N/A – Sails &amp; Rigging&quot; for sail/rigging work).</li>
        <li>Select service type (e.g. Oil Change, Annual Service, Sails &amp; Rigging).</li>
        <li>For DIY, tick the checklist items you completed; add notes, date and optional next service due.</li>
        <li>Attach invoices or photos if you have them.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-watermaker">
      <h3>Watermaker Service</h3>
      <p><em>This card is on <strong>every</strong> boat dashboard—you do not turn it on in Boat Details.</em></p>
      <p><strong>What it is:</strong> Unit details (make, model, location, rated output, serial number) plus multiple service entries. Each entry has date, tasks (pre-filters, carbon filter, membrane flush, pump oil), notes and an optional <strong>next service due</strong> date. Setting a next service due date adds a reminder to the Calendar 1 day before.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Watermaker Service. Enter or edit unit details with <strong>Edit</strong>, then <strong>Save</strong>.</li>
        <li>Tap <strong>Add service</strong> to log a new service; fill in date, tasks and notes.</li>
        <li>Set &quot;Next service due&quot; to get a calendar reminder.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-fuel">
      <h3>Fuel &amp; Performance</h3>
      <p><strong>What it is:</strong> Performance and tank settings (typical cruise RPM, speed, burn rate, tank capacity, preferred units) plus a log of fuel fills. You can record each fill with date, quantity, price, engine hours and notes to track consumption and costs over time.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Fuel &amp; Performance. Optionally fill in the Performance / Tank form (cruise RPM, speed, burn, capacity) and tap <strong>Save</strong>.</li>
        <li>Tap <strong>Add fill</strong> to log a fuel fill; enter quantity, price, hours and notes.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-electrical">
      <h3>Electrical &amp; Batteries</h3>
      <p><strong>What it is:</strong> Electrical system overview (voltage, shore power, inverter, solar, generator, charger) and a list of batteries. For each battery you store make, model, type, capacity, install date and optional next test or replacement date for reminders.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Electrical &amp; Batteries. Edit the system form (voltage, inverter, solar, etc.) and tap <strong>Save</strong>.</li>
        <li>Tap <strong>Add battery</strong> to add a battery; enter make, model, capacity and optional dates for reminders.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-mayday">
      <h3>Mayday / Distress Call</h3>
      <p><strong>What it is:</strong> An emergency tool to help you make a clear VHF distress call. You store vessel and contact details once (vessel name, callsign, MMSI, persons on board, emergency contact, liferaft, EPIRB, etc.). In an incident you enter position and nature of distress; the app builds a script you can read out on Channel 16. Scripts are provided for <strong>MAYDAY</strong> (immediate danger), <strong>PAN-PAN</strong> (urgent) and <strong>SÉCURITÉ</strong> (safety broadcast). In an emergency, always follow official coastguard guidance—this tool only helps you deliver a clear message.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Mayday / Distress Call. Fill in the setup form (vessel name, callsign, MMSI, persons on board, emergency contact, equipment) and tap <strong>Save</strong> so the script can use your details.</li>
        <li>When needed: enter position and nature of distress in &quot;At the moment&quot;; the readout updates. Choose MAYDAY, PAN-PAN or SÉCURITÉ, then read the script slowly over VHF 16 or use <strong>Copy script</strong>.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-haulout">
      <h3>Haul-Out Maintenance</h3>
      <p><strong>What it is:</strong> Records of work done when the boat is out of the water: antifoul (brand, type, coats), anodes, props, shaft, cutless bearings, rudder and steering, seacocks, hull condition and osmosis checks. You can store which yard or contractor was used, costs and notes, and set when the next haul-out is due for reminders.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Haul-Out Maintenance, then <strong>Add haul-out</strong>.</li>
        <li>Enter date, yard/contractor, and tick or describe the work done.</li>
        <li>Set &quot;Next haul-out due&quot; to get a reminder on the Calendar.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-projects">
      <h3>Projects &amp; Issues</h3>
      <p><strong>What it is:</strong> Plan refits and upgrades as <strong>Projects</strong>, and track defects or follow-ups as <strong>Issues</strong>. Each item can have category, priority, status, target date, cost and attachments.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap <strong>Projects &amp; Issues</strong>, then add a project or issue and update status as work progresses.</li>
        <li>Use filters and archive options to keep the active list manageable.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-inventory">
      <h3>Inventory</h3>
      <p><strong>What it is:</strong> Spares, consumables, sails, winches and rigging-related parts with optional stock levels, stowage locations, condition and replacement dates. Attention and low-stock cues help you restock before passages.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap <strong>Inventory</strong>, add an item (templates can speed up common kit), then <strong>Save</strong>.</li>
        <li>Where you track stock, set required quantity and current level; attach manuals or photos if useful.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-navigation">
      <h3>Navigation Equipment</h3>
      <p><strong>What it is:</strong> A register of plotters, radar, AIS, autopilot and other nav gear for this boat. For each item you store make, model, serial numbers, install and warranty dates. You can attach manuals or wiring diagrams and set warranty reminders.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Navigation Equipment, then <strong>Add item</strong>.</li>
        <li>Enter make, model, serial number, install date and warranty expiry.</li>
        <li>Attach manuals or diagrams; set a warranty reminder so you get an alert before expiry.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-safety">
      <h3>Safety Equipment</h3>
      <p><strong>What it is:</strong> A list of lifejackets, liferafts, flares, EPIRBs and other safety kit. For each item you record type, serial numbers, service intervals and location on board. Expiry and inspection due dates give you at-a-glance status and reminders before items expire.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Safety Equipment, then <strong>Add item</strong>.</li>
        <li>Enter type, serial number, location and expiry or next inspection date.</li>
        <li>Set reminders so you&apos;re notified before items need servicing or replacement.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-log">
      <h3>Passage Log</h3>
      <p><strong>What it is:</strong> A logbook for passages from a few hours to many days—coastal hops, island hops, or ocean crossings. Record start and end dates, departure and arrival, passage type (motor, sail, or both), optional engine hours, distance and notes. Works for motorboats and sailing boats.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap <strong>Passage Log</strong>, then <strong>Add Passage</strong>.</li>
        <li>Enter start date and optionally end date for multi-day passages. Choose passage type (Motor, Sail, or Motor &amp; Sail), departure and arrival, engine hours (add a row per engine if you have twins), distance and notes.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-links">
      <h3>Web Links</h3>
      <p><strong>What it is:</strong> Saved links for this boat—manuals, parts diagrams, marina portals, weather sites—so everything is in one place.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Web Links, then <strong>Add link</strong>.</li>
        <li>Enter a title and URL; tap <strong>Save</strong>. Open links from the list when you need them.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-calendar">
      <h3>Calendar &amp; Alerts</h3>
      <p><strong>Where:</strong> On the <strong>home page</strong> (not on the boat dashboard).</p>
      <p><strong>What it is:</strong> A calendar showing reminders from all your boats—warranties, engine and rigging maintenance schedules, next service, next haul-out, watermaker and more—plus your own appointments. You can assign each appointment to a boat and set reminders.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>From the home screen, tap the Calendar &amp; Alerts card.</li>
        <li>View upcoming reminders; add appointments with date, time, optional boat and reminder.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-account">
      <h3>Settings</h3>
      <p><strong>Where:</strong> On the <strong>home page</strong>. Shared across all boats.</p>
      <p><strong>What it is:</strong> Account-level settings: BoatMatey subscription, sign-in and sign-out. Add or archive boats from the Boats list; archived boats stay in the list but are read-only.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>From the home screen, tap the Settings (account) card.</li>
        <li>Manage subscription, sign out, or open the Boats list to add/edit/archive boats.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-guide">
      <h3>User Guide</h3>
      <p>You&apos;re here. The User Guide card opens this page from the home screen or from a boat&apos;s dashboard so you can quickly look up what each section does and how to use it.</p>
    </div>

    <div class="card guide-section guide-section-tips">
      <h3>Tips for using the dashboard</h3>
      <ul>
        <li>Tap any card to open that section for the current boat.</li>
        <li>Above the cards, use <strong>Export Boat Report</strong> to download a PDF summary when you need it (export is a Premium feature).</li>
        <li>Most sections let you attach photos, PDFs or links so everything stays in one place.</li>
        <li>Use Calendar &amp; Alerts (home screen) to see time-based reminders from engines, maintenance schedules, service, haul-outs, watermaker, warranties and more.</li>
        <li>Set boat type to <strong>Sailing</strong> in Boat Details to show the Sails &amp; Rigging card. <strong>Watermaker Service</strong> is always on the dashboard for every boat.</li>
        <li>Cards marked <strong>Premium</strong> may still open for a read-only preview on the free plan; saving in those modules needs an active subscription (except where a small free limit applies, such as one service entry per boat).</li>
        <li>Fill in the Mayday / Distress Call setup form in advance so in an emergency you only need to add position and nature of distress.</li>
        <li>Your data syncs to the cloud when signed in so you can use BoatMatey on multiple devices.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-faq">
      <h3>Frequently asked questions</h3>

      <h4>How do I add a new boat?</h4>
      <p>From the home screen, open <strong>Settings</strong> (or the Boats list from there). Use <strong>Add boat</strong> and enter name, type (motor, sailing or RIB) and other details. The new boat will appear on the home screen; tap it to open its dashboard.</p>

      <h4>Why don&apos;t I see the Sails &amp; Rigging card?</h4>
      <p><strong>Sails &amp; Rigging</strong> only appears when the boat type is <strong>Sailing</strong>. Edit the boat in Boat Details and set Boat type to Sailing. <strong>Watermaker Service</strong> is always shown on the boat dashboard.</p>

      <h4>Where do I log a sails and rigging service?</h4>
      <p>Use the <strong>Service History</strong> card. Add a new service, choose <strong>N/A – Sails &amp; Rigging</strong> as the engine (so no engine is linked), and select service type <strong>Sails &amp; Rigging</strong>. You&apos;ll get the dedicated sails/rigging checklist. The Sails &amp; Rigging card itself is for recording sail and rigging <em>details</em> (e.g. mainsail, mast notes), not individual service events.</p>

      <h4>How do reminders work?</h4>
      <p>When you set a &quot;next service due&quot;, engine or rigging <strong>maintenance schedule</strong> due date, &quot;next haul-out due&quot;, warranty expiry or similar date in the relevant section (Service History, Haul-Out, Navigation, Safety, Watermaker, etc.), a reminder is created on the <strong>Calendar &amp; Alerts</strong> (home screen). Open the Calendar to see all upcoming reminders and add your own appointments.</p>

      <h4>What does the free plan include versus Premium?</h4>
      <p>On the <strong>free</strong> plan you get full use of core areas: <strong>Boat Details</strong>, <strong>Engines</strong>, <strong>Service History</strong> (one completed service entry per boat), <strong>Mayday / Distress Call</strong>, <strong>Web Links</strong>, and access to your boat <strong>reminder</strong> view, plus the guided setup flow on the dashboard. <strong>Premium</strong> unlocks unlimited service history, inventory, projects and issues, passage log, fuel and electrical records, haul-out, navigation and safety registers, sailing and rigging schedules, calendar alerts beyond the free scope, export boat report, and saving across those modules without hitting free preview limits.</p>

      <h4>Can I use BoatMatey on more than one device?</h4>
      <p>Yes. Sign in with the same account on each device. Your boats, engines, service history, and other data sync via the cloud so you can view and edit from phone, tablet or computer.</p>

      <h4>What happens if I archive a boat?</h4>
      <p>Archived boats stay in your list but become read-only: you can view all data but not add or edit entries. Use this when you sell a boat or stop using it but want to keep the records. You can still restore or delete from Settings / Boats if needed.</p>

      <h4>Where are my attachments stored?</h4>
      <p>Photos, PDFs and other files you attach to boats, engines, service entries, equipment and similar are stored with your account and sync across devices when you&apos;re signed in. They are tied to the specific boat and record you attached them to.</p>
    </div>
  `;

  container.appendChild(headerBlock);
  container.appendChild(guideBody);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

export default { render };
