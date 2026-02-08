/**
 * Boat Dashboard Guide Page
 * Explains what each dashboard card does and how to use it.
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
      This guide explains every section of BoatMatey and how to use it. From the home screen you can open
      Calendar &amp; Alerts, Settings, or tap a boat to see its dashboard. Open this guide anytime from the
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
      <p><strong>What it is:</strong> The main profile for this boat—name, make &amp; model, type (motor or sailing), photo, dimensions, fuel type, home marina, registration, insurance and purchase date. You can turn on &quot;Watermaker installed&quot; here; when enabled, the Watermaker Service card appears on the dashboard.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap the Boat Details card, then edit the form and tap <strong>Save</strong>.</li>
        <li>Set <strong>Boat type</strong> to Sailing if you have a sailboat—this shows the Sails &amp; Rigging card.</li>
        <li>Attach documents (e.g. registration, insurance) via the attachments area.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-engines">
      <h3>Engines</h3>
      <p><strong>What it is:</strong> A list of every engine or drive on this boat. For each one you store position (e.g. port/starboard), make, model, serial number and hours. Sailing boats can still record an auxiliary engine. Service entries and reminders link to these records.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Engines, then <strong>Add engine</strong> to create a new entry.</li>
        <li>Fill in make, model, serial number, position and current hours.</li>
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
      <p><em>This card only appears when &quot;Watermaker installed&quot; is turned on in Boat Details.</em></p>
      <p><strong>What it is:</strong> Unit details (make, model, location, rated output, serial number) plus multiple service entries. Each entry has date, tasks (pre-filters, carbon filter, membrane flush, pump oil), notes and an optional <strong>next service due</strong> date. Setting a next service due date adds a reminder to the Calendar 1 day before.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Watermaker Service. Enter or edit unit details with <strong>Edit</strong>, then <strong>Save</strong>.</li>
        <li>Tap <strong>Add service</strong> to log a new service; fill in date, tasks and notes.</li>
        <li>Set &quot;Next service due&quot; to get a calendar reminder.</li>
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

    <div class="card guide-section guide-section-sails-rigging">
      <h3>Sails &amp; Rigging</h3>
      <p><em>This card only appears when the boat type is set to Sailing in Boat Details.</em></p>
      <p><strong>What it is:</strong> A single form to record mainsail, headsails, mast and spar, standing and running rigging, winches, last inspection date and general notes. It does <strong>not</strong> log individual services—for that you use the <strong>Service History</strong> card and choose &quot;N/A – Sails &amp; Rigging&quot; and the Sails &amp; Rigging checklist.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Sails &amp; Rigging to view or edit the details form; tap <strong>Save</strong> when done.</li>
        <li>To record a sails/rigging <em>service</em>, use the <strong>Service History</strong> card and select &quot;N/A – Sails &amp; Rigging&quot; as the engine, then use the dedicated checklist.</li>
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
        <li>Set reminders so you're notified before items need servicing or replacement.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-log">
      <h3>Ship&apos;s Log</h3>
      <p><strong>What it is:</strong> A simple logbook of trips and passages: dates, departure and arrival, engine hours, distance and notes. Over time it builds a history you can use for planning, surveys or when selling the boat.</p>
      <p><strong>How to use it:</strong></p>
      <ul>
        <li>Tap Ship&apos;s Log, then <strong>Add trip</strong>.</li>
        <li>Enter departure and arrival (date/time or place), engine hours, distance and any notes.</li>
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
      <p><strong>What it is:</strong> A calendar showing reminders from all your boats—warranties, next service, next haul-out—plus your own appointments. You can assign each appointment to a boat and set reminders.</p>
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
        <li>Most sections let you attach photos, PDFs or links so everything stays in one place.</li>
        <li>Use Calendar &amp; Alerts (home screen) to see time-based reminders from engines, service, haul-outs and warranties.</li>
        <li>Turn on &quot;Watermaker installed&quot; in Boat Details to show the Watermaker Service card; set boat type to Sailing to see the Sails &amp; Rigging card.</li>
        <li>Your data syncs to the cloud when signed in so you can use BoatMatey on multiple devices.</li>
      </ul>
    </div>

    <div class="card guide-section guide-section-faq">
      <h3>Frequently asked questions</h3>

      <h4>How do I add a new boat?</h4>
      <p>From the home screen, open <strong>Settings</strong> (or the Boats list from there). Use <strong>Add boat</strong> and enter name, type (motor/sailing) and other details. The new boat will appear on the home screen; tap it to open its dashboard.</p>

      <h4>Why don&apos;t I see the Sails &amp; Rigging or Watermaker card?</h4>
      <p><strong>Sails &amp; Rigging</strong> only appears when the boat type is <strong>Sailing</strong>. Edit the boat in Boat Details and set Boat type to Sailing. <strong>Watermaker Service</strong> only appears when &quot;Watermaker installed&quot; is turned on—enable it in Boat Details.</p>

      <h4>Where do I log a sails and rigging service?</h4>
      <p>Use the <strong>Service History</strong> card. Add a new service, choose <strong>N/A – Sails &amp; Rigging</strong> as the engine (so no engine is linked), and select service type <strong>Sails &amp; Rigging</strong>. You&apos;ll get the dedicated sails/rigging checklist. The Sails &amp; Rigging card itself is for recording sail and rigging <em>details</em> (e.g. mainsail, mast notes), not individual service events.</p>

      <h4>How do reminders work?</h4>
      <p>When you set a &quot;next service due&quot;, &quot;next haul-out due&quot;, warranty expiry or similar date in the relevant section (Service History, Haul-Out, Navigation, Safety, Watermaker), a reminder is created on the <strong>Calendar &amp; Alerts</strong> (home screen). Open the Calendar to see all upcoming reminders and add your own appointments.</p>

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

export default {
  render
};
