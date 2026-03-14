/**
 * Boat export data collector.
 * Gathers all boat-related data for one selected boat for the PDF report.
 * Uses existing dataService; resilient to empty or failed sections.
 */

import {
  getBoat,
  getEngines,
  getServiceEntries,
  getEquipment,
  getLogbook,
  getHaulouts,
  getLinks,
  getProjects,
  getInventory,
  getFuelPerformance,
  getFuelLogs,
  getBatteries,
  getBoatElectrical,
  getBoatDistressInfo,
  getCalendarEvents
} from './dataService.js';

/**
 * Collect all data for a boat export report.
 * @param {string} boatId - Selected boat id
 * @returns {Promise<{ boat: Object|null, sections: Object }>}
 */
export async function collectBoatExportData(boatId) {
  if (!boatId) {
    return { boat: null, sections: {} };
  }

  const [boat, engines, serviceEntries, navEquipment, safetyEquipment, logbook, haulouts, links, projects, inventory, fuelPerformance, fuelLogs, batteries, boatElectrical, distressInfo, calendarEvents] = await Promise.all([
    getBoat(boatId).catch(() => null),
    getEngines(boatId).catch(() => []),
    getServiceEntries(boatId).catch(() => []),
    getEquipment(boatId, 'navigation').catch(() => []),
    getEquipment(boatId, 'safety').catch(() => []),
    getLogbook(boatId).catch(() => []),
    getHaulouts(boatId).catch(() => []),
    getLinks(boatId).catch(() => []),
    getProjects(boatId).catch(() => []),
    getInventory(boatId).catch(() => []),
    getFuelPerformance(boatId).catch(() => null),
    getFuelLogs(boatId).catch(() => []),
    getBatteries(boatId).catch(() => []),
    getBoatElectrical(boatId).catch(() => null),
    getBoatDistressInfo(boatId).catch(() => null),
    getCalendarEvents(boatId).catch(() => [])
  ]);

  return {
    boat: boat || null,
    sections: {
      engines: Array.isArray(engines) ? engines : [],
      serviceHistory: Array.isArray(serviceEntries) ? serviceEntries : [],
      navigationEquipment: Array.isArray(navEquipment) ? navEquipment : [],
      safetyEquipment: Array.isArray(safetyEquipment) ? safetyEquipment : [],
      logbook: Array.isArray(logbook) ? logbook : [],
      haulouts: Array.isArray(haulouts) ? haulouts : [],
      links: Array.isArray(links) ? links : [],
      projects: Array.isArray(projects) ? projects : [],
      inventory: Array.isArray(inventory) ? inventory : [],
      fuelPerformance: fuelPerformance || null,
      fuelLogs: Array.isArray(fuelLogs) ? fuelLogs : [],
      batteries: Array.isArray(batteries) ? batteries : [],
      boatElectrical: boatElectrical || null,
      distressInfo: distressInfo || null,
      calendarEvents: Array.isArray(calendarEvents) ? calendarEvents : []
    }
  };
}
