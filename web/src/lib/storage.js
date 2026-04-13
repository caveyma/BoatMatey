/**
 * Storage layer - localStorage wrapper
 * Designed to be easily swapped with Supabase later
 */

const STORAGE_KEYS = {
  BOATS: 'boatmatey_boats', // List of all boats
  ENGINES: 'boatmatey_engines', // Scoped by boat_id
  SERVICE_HISTORY: 'boatmatey_service_history', // Scoped by boat_id
  HAULOUTS: 'boatmatey_haulouts', // Scoped by boat_id
  NAV_EQUIPMENT: 'boatmatey_nav_equipment', // Scoped by boat_id
  SAFETY_EQUIPMENT: 'boatmatey_safety_equipment', // Scoped by boat_id
  SHIPS_LOG: 'boatmatey_ships_log', // Scoped by boat_id
  LINKS: 'boatmatey_links', // Scoped by boat_id
  PROJECTS: 'boatmatey_projects', // Scoped by boat_id
  INVENTORY: 'boatmatey_inventory', // Scoped by boat_id
  UPLOADS: 'boatmatey_uploads', // Scoped by boat_id
  CALENDAR_EVENTS: 'boatmatey_calendar_events', // Scoped by boat_id
  /** Per-engine maintenance plans (intervals, last done); scoped by boat_id */
  ENGINE_MAINTENANCE_SCHEDULES: 'boatmatey_engine_maintenance_schedules',
  /** Sail & rigging maintenance plans (calendar months only); scoped by boat_id */
  SAILS_RIGGING_MAINTENANCE_SCHEDULES: 'boatmatey_sails_rigging_maintenance_schedules',
  SETTINGS: 'boatmatey_settings',
  /** Per-boat ISO timestamp when dashboard onboarding first reached “setup complete” (reminder flow done). */
  BOAT_DASHBOARD_SETUP_COMPLETE_AT: 'boatmatey_boat_dashboard_setup_complete_at'
};

/**
 * Generic storage operations
 */
export const storage = {
  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.error(`Error reading ${key}:`, e);
      return defaultValue;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Error writing ${key}:`, e);
      return false;
    }
  },

  remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`Error removing ${key}:`, e);
      return false;
    }
  },

  clear() {
    try {
      Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
      return true;
    } catch (e) {
      console.error('Error clearing storage:', e);
      return false;
    }
  }
};

/**
 * Boats operations (multiple boats support)
 */
export const boatsStorage = {
  getAll() {
    return storage.get(STORAGE_KEYS.BOATS, []);
  },

  get(id) {
    const boats = this.getAll();
    return boats.find(b => b.id === id) || null;
  },

  save(boat) {
    const boats = this.getAll();
    if (boat.id) {
      const index = boats.findIndex(b => b.id === boat.id);
      if (index >= 0) {
        boats[index] = { ...boat, updated_at: new Date().toISOString() };
      } else {
        boats.push({ ...boat, created_at: new Date().toISOString() });
      }
    } else {
      boat.id = `boat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      boat.created_at = new Date().toISOString();
      boats.push(boat);
    }
    return storage.set(STORAGE_KEYS.BOATS, boats);
  },

  delete(id) {
    const boats = this.getAll();
    const filtered = boats.filter(b => b.id !== id);
    // Also delete all boat-specific data
    this.deleteBoatData(id);
    return storage.set(STORAGE_KEYS.BOATS, filtered);
  },

  deleteBoatData(boatId) {
    // Delete all data associated with this boat
    const engines = enginesStorage.getAll().filter(e => e.boat_id !== boatId);
    storage.set(STORAGE_KEYS.ENGINES, engines);
    
    const services = serviceHistoryStorage.getAll().filter(s => s.boat_id !== boatId);
    storage.set(STORAGE_KEYS.SERVICE_HISTORY, services);

    const haulouts = hauloutStorage.getAll().filter(h => h.boat_id !== boatId);
    storage.set(STORAGE_KEYS.HAULOUTS, haulouts);
    
    const nav = navEquipmentStorage.getAll().filter(n => n.boat_id !== boatId);
    storage.set(STORAGE_KEYS.NAV_EQUIPMENT, nav);
    
    const safety = safetyEquipmentStorage.getAll().filter(s => s.boat_id !== boatId);
    storage.set(STORAGE_KEYS.SAFETY_EQUIPMENT, safety);
    
    const logs = shipsLogStorage.getAll().filter(l => l.boat_id !== boatId);
    storage.set(STORAGE_KEYS.SHIPS_LOG, logs);
    
    const links = linksStorage.getAll().filter(l => l.boat_id !== boatId);
    storage.set(STORAGE_KEYS.LINKS, links);

    const projects = projectsStorage.getAll().filter(p => p.boat_id !== boatId);
    storage.set(STORAGE_KEYS.PROJECTS, projects);

    const inventory = inventoryStorage.getAll().filter(i => i.boat_id !== boatId);
    storage.set(STORAGE_KEYS.INVENTORY, inventory);

    const maintSched = engineMaintenanceScheduleStorage.getAll().filter(s => s.boat_id !== boatId);
    storage.set(STORAGE_KEYS.ENGINE_MAINTENANCE_SCHEDULES, maintSched);

    const uploads = uploadsStorage.getAll().filter(u => u.boat_id !== boatId);
    storage.set(STORAGE_KEYS.UPLOADS, uploads);

    boatDashboardSetupCompleteStorage.removeForBoat(boatId);
  }
};

/** First time a boat’s setup is complete (per local UX); used for day-2-style nudges. */
export const boatDashboardSetupCompleteStorage = {
  getRecordedAt(boatId) {
    if (!boatId) return null;
    const map = storage.get(STORAGE_KEYS.BOAT_DASHBOARD_SETUP_COMPLETE_AT, {});
    return map[boatId] || null;
  },

  recordFirstComplete(boatId) {
    if (!boatId) return null;
    const map = { ...storage.get(STORAGE_KEYS.BOAT_DASHBOARD_SETUP_COMPLETE_AT, {}) };
    if (!map[boatId]) {
      map[boatId] = new Date().toISOString();
      storage.set(STORAGE_KEYS.BOAT_DASHBOARD_SETUP_COMPLETE_AT, map);
    }
    return map[boatId];
  },

  removeForBoat(boatId) {
    if (!boatId) return;
    const map = { ...storage.get(STORAGE_KEYS.BOAT_DASHBOARD_SETUP_COMPLETE_AT, {}) };
    if (!(boatId in map)) return;
    delete map[boatId];
    storage.set(STORAGE_KEYS.BOAT_DASHBOARD_SETUP_COMPLETE_AT, map);
  }
};

// Legacy support - redirect to boatsStorage
export const boatStorage = {
  get() {
    const boats = boatsStorage.getAll();
    return boats.length > 0 ? boats[0] : null; // Return first boat for backward compatibility
  },
  save(boat) {
    if (!boat.id) {
      boat.id = `boat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return boatsStorage.save(boat);
  },
  delete() {
    const boats = boatsStorage.getAll();
    if (boats.length > 0) {
      return boatsStorage.delete(boats[0].id);
    }
    return false;
  }
};

/**
 * Engines operations (scoped by boat_id)
 */
export const enginesStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.ENGINES, []);
    if (boatId) {
      return all.filter(e => e.boat_id === boatId);
    }
    return all;
  },

  get(id) {
    const engines = this.getAll();
    return engines.find(e => e.id === id) || null;
  },

  save(engine, boatId = null) {
    const engines = this.getAll();
    if (engine.id) {
      const index = engines.findIndex(e => e.id === engine.id);
      if (index >= 0) {
        engines[index] = { ...engine, updated_at: new Date().toISOString() };
      } else {
        engines.push({ ...engine, boat_id: boatId || engine.boat_id, created_at: new Date().toISOString() });
      }
    } else {
      engine.id = `engine_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      engine.boat_id = boatId || engine.boat_id;
      engine.created_at = new Date().toISOString();
      engines.push(engine);
    }
    return storage.set(STORAGE_KEYS.ENGINES, engines);
  },

  delete(id) {
    const engines = this.getAll();
    const filtered = engines.filter(e => e.id !== id);
    return storage.set(STORAGE_KEYS.ENGINES, filtered);
  },

  /** Replace all engines for a boat (used when syncing from API). */
  replaceForBoat(boatId, engines) {
    const all = this.getAll().filter(e => e.boat_id !== boatId);
    const withBoatId = (engines || []).map(e => ({ ...e, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.ENGINES, all.concat(withBoatId));
  }
};

/**
 * Engine maintenance schedule rows (planning layer; scoped by boat_id, keyed by engine_id).
 */
export const engineMaintenanceScheduleStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.ENGINE_MAINTENANCE_SCHEDULES, []);
    if (boatId) return all.filter((s) => s.boat_id === boatId);
    return all;
  },

  getForEngine(engineId) {
    return this.getAll().filter((s) => s.engine_id === engineId);
  },

  get(id) {
    return this.getAll().find((s) => s.id === id) || null;
  },

  save(row, boatId = null) {
    const all = this.getAll();
    const bid = boatId || row.boat_id;
    if (row.id) {
      const index = all.findIndex((s) => s.id === row.id);
      if (index >= 0) {
        all[index] = { ...row, boat_id: bid, updated_at: new Date().toISOString() };
      } else {
        all.push({ ...row, boat_id: bid, created_at: new Date().toISOString() });
      }
    } else {
      row.id = `ems_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      row.boat_id = bid;
      row.created_at = new Date().toISOString();
      all.push(row);
    }
    return storage.set(STORAGE_KEYS.ENGINE_MAINTENANCE_SCHEDULES, all);
  },

  delete(id) {
    const filtered = this.getAll().filter((s) => s.id !== id);
    return storage.set(STORAGE_KEYS.ENGINE_MAINTENANCE_SCHEDULES, filtered);
  },

  replaceForBoat(boatId, rows) {
    const all = this.getAll().filter((s) => s.boat_id !== boatId);
    const next = (rows || []).map((r) => ({ ...r, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.ENGINE_MAINTENANCE_SCHEDULES, all.concat(next));
  },

  removeByEngineId(engineId) {
    const filtered = this.getAll().filter((s) => s.engine_id !== engineId);
    return storage.set(STORAGE_KEYS.ENGINE_MAINTENANCE_SCHEDULES, filtered);
  }
};

/**
 * Sails & rigging maintenance schedule rows (planning; calendar months only).
 */
export const sailsRiggingMaintenanceScheduleStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.SAILS_RIGGING_MAINTENANCE_SCHEDULES, []);
    if (boatId) return all.filter((s) => s.boat_id === boatId);
    return all;
  },

  get(id) {
    return this.getAll().find((s) => s.id === id) || null;
  },

  save(row, boatId = null) {
    const all = this.getAll();
    const bid = boatId || row.boat_id;
    if (row.id) {
      const index = all.findIndex((s) => s.id === row.id);
      if (index >= 0) {
        all[index] = { ...row, boat_id: bid, updated_at: new Date().toISOString() };
      } else {
        all.push({ ...row, boat_id: bid, created_at: new Date().toISOString() });
      }
    } else {
      row.id = `srms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      row.boat_id = bid;
      row.created_at = new Date().toISOString();
      all.push(row);
    }
    return storage.set(STORAGE_KEYS.SAILS_RIGGING_MAINTENANCE_SCHEDULES, all);
  },

  delete(id) {
    const filtered = this.getAll().filter((s) => s.id !== id);
    return storage.set(STORAGE_KEYS.SAILS_RIGGING_MAINTENANCE_SCHEDULES, filtered);
  },

  replaceForBoat(boatId, rows) {
    const all = this.getAll().filter((s) => s.boat_id !== boatId);
    const next = (rows || []).map((r) => ({ ...r, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.SAILS_RIGGING_MAINTENANCE_SCHEDULES, all.concat(next));
  }
};

/**
 * Service History operations (scoped by boat_id)
 */
export const serviceHistoryStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.SERVICE_HISTORY, []);
    if (boatId) {
      return all.filter(e => e.boat_id === boatId);
    }
    return all;
  },

  get(id) {
    const entries = this.getAll();
    return entries.find(e => e.id === id) || null;
  },

  save(entry, boatId = null) {
    const entries = this.getAll();
    if (entry.id) {
      const index = entries.findIndex(e => e.id === entry.id);
      if (index >= 0) {
        entries[index] = { ...entry, updated_at: new Date().toISOString() };
      } else {
        entries.push({ ...entry, boat_id: boatId || entry.boat_id, created_at: new Date().toISOString() });
      }
    } else {
      entry.id = `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      entry.boat_id = boatId || entry.boat_id;
      entry.created_at = new Date().toISOString();
      entries.push(entry);
    }
    // Sort by date descending (newest first)
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    return storage.set(STORAGE_KEYS.SERVICE_HISTORY, entries);
  },

  delete(id) {
    const entries = this.getAll();
    const filtered = entries.filter(e => e.id !== id);
    return storage.set(STORAGE_KEYS.SERVICE_HISTORY, filtered);
  },

  replaceForBoat(boatId, entries) {
    const all = this.getAll().filter(e => e.boat_id !== boatId);
    const withBoatId = (entries || []).map(e => ({ ...e, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.SERVICE_HISTORY, all.concat(withBoatId));
  },

  getByEngine(engineId) {
    return this.getAll().filter(e => e.engine_id === engineId);
  }
};

/**
 * Haul-out Maintenance operations (scoped by boat_id)
 * Mirrors service history patterns but for lift-out events.
 */
export const hauloutStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.HAULOUTS, []);
    if (boatId) {
      return all.filter(e => e.boat_id === boatId);
    }
    return all;
  },

  get(id) {
    const entries = this.getAll();
    return entries.find(e => e.id === id) || null;
  },

  save(entry, boatId = null) {
    const entries = this.getAll();
    if (entry.id) {
      const index = entries.findIndex(e => e.id === entry.id);
      if (index >= 0) {
        entries[index] = { ...entry, updated_at: new Date().toISOString() };
      } else {
        entries.push({ ...entry, boat_id: boatId || entry.boat_id, created_at: new Date().toISOString() });
      }
    } else {
      entry.id = `haulout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      entry.boat_id = boatId || entry.boat_id;
      entry.created_at = new Date().toISOString();
      entries.push(entry);
    }
    // Sort by haul-out date descending (newest first)
    entries.sort((a, b) => new Date(b.haulout_date) - new Date(a.haulout_date));
    return storage.set(STORAGE_KEYS.HAULOUTS, entries);
  },

  delete(id) {
    const entries = this.getAll();
    const filtered = entries.filter(e => e.id !== id);
    return storage.set(STORAGE_KEYS.HAULOUTS, filtered);
  },

  replaceForBoat(boatId, entries) {
    const all = this.getAll().filter(e => e.boat_id !== boatId);
    const withBoatId = (entries || []).map(e => ({ ...e, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.HAULOUTS, all.concat(withBoatId));
  }
};

/**
 * Navigation Equipment operations (scoped by boat_id)
 */
export const navEquipmentStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.NAV_EQUIPMENT, []);
    if (boatId) {
      return all.filter(e => e.boat_id === boatId);
    }
    return all;
  },

  get(id) {
    const items = this.getAll();
    return items.find(e => e.id === id) || null;
  },

  save(item, boatId = null) {
    const items = this.getAll();
    if (item.id) {
      const index = items.findIndex(e => e.id === item.id);
      if (index >= 0) {
        items[index] = { ...item, updated_at: new Date().toISOString() };
      } else {
        items.push({ ...item, boat_id: boatId || item.boat_id, created_at: new Date().toISOString() });
      }
    } else {
      item.id = `nav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      item.boat_id = boatId || item.boat_id;
      item.created_at = new Date().toISOString();
      items.push(item);
    }
    return storage.set(STORAGE_KEYS.NAV_EQUIPMENT, items);
  },

  delete(id) {
    const items = this.getAll();
    const filtered = items.filter(e => e.id !== id);
    return storage.set(STORAGE_KEYS.NAV_EQUIPMENT, filtered);
  },

  replaceForBoat(boatId, items) {
    const all = this.getAll().filter(e => e.boat_id !== boatId);
    const withBoatId = (items || []).map(e => ({ ...e, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.NAV_EQUIPMENT, all.concat(withBoatId));
  }
};

/**
 * Safety Equipment operations (scoped by boat_id)
 */
export const safetyEquipmentStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.SAFETY_EQUIPMENT, []);
    if (boatId) {
      return all.filter(e => e.boat_id === boatId);
    }
    return all;
  },

  get(id) {
    const items = this.getAll();
    return items.find(e => e.id === id) || null;
  },

  save(item, boatId = null) {
    const items = this.getAll();
    if (item.id) {
      const index = items.findIndex(e => e.id === item.id);
      if (index >= 0) {
        items[index] = { ...item, updated_at: new Date().toISOString() };
      } else {
        items.push({ ...item, boat_id: boatId || item.boat_id, created_at: new Date().toISOString() });
      }
    } else {
      item.id = `safety_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      item.boat_id = boatId || item.boat_id;
      item.created_at = new Date().toISOString();
      items.push(item);
    }
    return storage.set(STORAGE_KEYS.SAFETY_EQUIPMENT, items);
  },

  delete(id) {
    const items = this.getAll();
    const filtered = items.filter(e => e.id !== id);
    return storage.set(STORAGE_KEYS.SAFETY_EQUIPMENT, filtered);
  },

  replaceForBoat(boatId, items) {
    const all = this.getAll().filter(e => e.boat_id !== boatId);
    const withBoatId = (items || []).map(e => ({ ...e, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.SAFETY_EQUIPMENT, all.concat(withBoatId));
  }
};

/**
 * Ship's Log operations (scoped by boat_id)
 */
export const shipsLogStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.SHIPS_LOG, []);
    if (boatId) {
      return all.filter(e => e.boat_id === boatId);
    }
    return all;
  },

  get(id) {
    const entries = this.getAll();
    return entries.find(e => e.id === id) || null;
  },

  save(entry, boatId = null) {
    const entries = this.getAll();
    if (entry.id) {
      const index = entries.findIndex(e => e.id === entry.id);
      if (index >= 0) {
        entries[index] = { ...entry, updated_at: new Date().toISOString() };
      } else {
        entries.push({ ...entry, boat_id: boatId || entry.boat_id, created_at: new Date().toISOString() });
      }
    } else {
      entry.id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      entry.boat_id = boatId || entry.boat_id;
      entry.created_at = new Date().toISOString();
      entries.push(entry);
    }
    // Sort by date descending (newest first)
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    return storage.set(STORAGE_KEYS.SHIPS_LOG, entries);
  },

  delete(id) {
    const entries = this.getAll();
    const filtered = entries.filter(e => e.id !== id);
    return storage.set(STORAGE_KEYS.SHIPS_LOG, filtered);
  },

  replaceForBoat(boatId, entries) {
    const all = this.getAll().filter(e => e.boat_id !== boatId);
    const withBoatId = (entries || []).map(e => ({ ...e, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.SHIPS_LOG, all.concat(withBoatId));
  }
};

/**
 * Links operations (scoped by boat_id)
 */
export const linksStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.LINKS, []);
    let links = boatId ? all.filter(l => l.boat_id === boatId) : all;
    
    if (boatId) {
      // Remove retired legacy default.
      const withoutLegacy = links.filter((l) => !(l?.name === 'Local Marina' && l?.url === 'https://example.com'));
      if (withoutLegacy.length !== links.length) {
        links = withoutLegacy;
      }

      // Ensure BoatMatey default exists for all boats (including existing ones).
      const hasBoatMatey = links.some((l) => (l?.url || '').toLowerCase() === 'https://boatmatey.com');
      if (!hasBoatMatey) {
        links.unshift({
          id: `link_boatmatey_${boatId}`,
          name: 'BoatMatey',
          url: 'https://boatmatey.com',
          boat_id: boatId
        });
      }

      // Seed defaults if a boat has no links at all.
      if (links.length === 0) {
        links = [
          { id: `link_boatmatey_${boatId}`, name: 'BoatMatey', url: 'https://boatmatey.com', boat_id: boatId },
          { id: `link_navionics_${boatId}`, name: 'Navionics', url: 'https://www.navionics.com', boat_id: boatId },
          { id: `link_metoffice_${boatId}`, name: 'Met Office Marine', url: 'https://www.metoffice.gov.uk/weather/marine', boat_id: boatId },
          { id: `link_windy_${boatId}`, name: 'Windy', url: 'https://www.windy.com', boat_id: boatId }
        ];
      }

      const rest = all.filter((l) => l.boat_id !== boatId);
      storage.set(STORAGE_KEYS.LINKS, rest.concat(links));
    }
    return links;
  },

  get(id) {
    const links = this.getAll();
    return links.find(e => e.id === id) || null;
  },

  save(link, boatId = null) {
    const allLinks = storage.get(STORAGE_KEYS.LINKS, []);
    link.boat_id = boatId || link.boat_id;
    
    if (link.id && !link.id.startsWith('link_')) {
      const index = allLinks.findIndex(e => e.id === link.id);
      if (index >= 0) {
        allLinks[index] = { ...link, updated_at: new Date().toISOString() };
      } else {
        allLinks.push({ ...link, created_at: new Date().toISOString() });
      }
    } else {
      link.id = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      link.created_at = new Date().toISOString();
      allLinks.push(link);
    }
    return storage.set(STORAGE_KEYS.LINKS, allLinks);
  },

  delete(id) {
    const links = this.getAll();
    const filtered = links.filter(e => e.id !== id);
    return storage.set(STORAGE_KEYS.LINKS, filtered);
  },

  replaceForBoat(boatId, links) {
    const all = this.getAll().filter(l => l.boat_id !== boatId);
    const withBoatId = (links || []).map(l => ({ ...l, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.LINKS, all.concat(withBoatId));
  }
};

/**
 * Projects operations (scoped by boat_id)
 * Planned or in-progress boat projects/upgrades/refit.
 */
export const projectsStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.PROJECTS, []);
    if (boatId) {
      return all.filter(p => p.boat_id === boatId);
    }
    return all;
  },

  get(id) {
    const projects = this.getAll();
    return projects.find(p => p.id === id) || null;
  },

  save(entry, boatId = null) {
    const entries = this.getAll();
    if (entry.id) {
      const index = entries.findIndex(e => e.id === entry.id);
      if (index >= 0) {
        entries[index] = { ...entry, updated_at: new Date().toISOString() };
      } else {
        entries.push({ ...entry, boat_id: boatId || entry.boat_id, created_at: new Date().toISOString() });
      }
    } else {
      entry.id = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      entry.boat_id = boatId || entry.boat_id;
      entry.created_at = new Date().toISOString();
      entries.push(entry);
    }
    return storage.set(STORAGE_KEYS.PROJECTS, entries);
  },

  delete(id) {
    const entries = this.getAll();
    const filtered = entries.filter(e => e.id !== id);
    return storage.set(STORAGE_KEYS.PROJECTS, filtered);
  },

  replaceForBoat(boatId, entries) {
    const all = this.getAll().filter(e => e.boat_id !== boatId);
    const withBoatId = (entries || []).map(e => ({ ...e, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.PROJECTS, all.concat(withBoatId));
  }
};

/**
 * Inventory operations (scoped by boat_id)
 * Onboard stock with required level, in-stock level, low-stock alerts.
 */
export const inventoryStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.INVENTORY, []);
    if (boatId) {
      return all.filter(i => i.boat_id === boatId);
    }
    return all;
  },

  get(id) {
    const items = this.getAll();
    return items.find(i => i.id === id) || null;
  },

  save(item, boatId = null) {
    const items = this.getAll();
    if (item.id) {
      const index = items.findIndex(i => i.id === item.id);
      if (index >= 0) {
        items[index] = { ...item, updated_at: new Date().toISOString() };
      } else {
        items.push({ ...item, boat_id: boatId || item.boat_id, created_at: new Date().toISOString() });
      }
    } else {
      item.id = `inventory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      item.boat_id = boatId || item.boat_id;
      item.created_at = new Date().toISOString();
      items.push(item);
    }
    return storage.set(STORAGE_KEYS.INVENTORY, items);
  },

  delete(id) {
    const items = this.getAll();
    const filtered = items.filter(i => i.id !== id);
    return storage.set(STORAGE_KEYS.INVENTORY, filtered);
  },

  replaceForBoat(boatId, items) {
    const all = this.getAll().filter(i => i.boat_id !== boatId);
    const withBoatId = (items || []).map(i => ({ ...i, boat_id: boatId }));
    return storage.set(STORAGE_KEYS.INVENTORY, all.concat(withBoatId));
  }
};

/**
 * Uploads operations
 */
export const uploadsStorage = {
  getAll() {
    return storage.get(STORAGE_KEYS.UPLOADS, []);
  },

  get(id) {
    const uploads = this.getAll();
    return uploads.find(u => u.id === id) || null;
  },

  getByEntity(entityType, entityId, boatId = null) {
    const all = this.getAll();
    return all.filter(u => u.entity_type === entityType && u.entity_id === entityId && (!boatId || u.boat_id === boatId));
  },

  save(upload, boatId = null) {
    const uploads = this.getAll();
    upload.boat_id = boatId || upload.boat_id;
    if (upload.id) {
      const index = uploads.findIndex(u => u.id === upload.id);
      if (index >= 0) {
        uploads[index] = { ...upload, updated_at: new Date().toISOString() };
      } else {
        uploads.push({ ...upload, created_at: new Date().toISOString() });
      }
    } else {
      upload.id = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      upload.created_at = new Date().toISOString();
      uploads.push(upload);
    }
    return storage.set(STORAGE_KEYS.UPLOADS, uploads);
  },

  delete(id) {
    const uploads = this.getAll();
    const filtered = uploads.filter(u => u.id !== id);
    return storage.set(STORAGE_KEYS.UPLOADS, filtered);
  },

  /** Update entity_id for uploads (e.g. after a new haul-out record gets a real UUID from the server). */
  rekeyEntity(entityType, oldEntityId, newEntityId, boatId = null) {
    if (!oldEntityId || !newEntityId || oldEntityId === newEntityId) return;
    const uploads = this.getAll();
    let changed = false;
    const next = uploads.map((u) => {
      if (
        u.entity_type === entityType &&
        String(u.entity_id) === String(oldEntityId) &&
        (!boatId || u.boat_id === boatId)
      ) {
        changed = true;
        return { ...u, entity_id: newEntityId, updated_at: new Date().toISOString() };
      }
      return u;
    });
    if (changed) {
      storage.set(STORAGE_KEYS.UPLOADS, next);
    }
  },

  count(boatId = null) {
    return this.getAll(boatId).length;
  }
};

/**
 * Calendar events operations (scoped by boat_id)
 * Used by the Calendar & Alerts page for user-created appointments.
 */
export const calendarEventsStorage = {
  getAll(boatId = null) {
    const all = storage.get(STORAGE_KEYS.CALENDAR_EVENTS, []);
    if (boatId) {
      return all.filter(e => e.boat_id === boatId);
    }
    return all;
  },

  get(id) {
    const events = this.getAll();
    return events.find(e => e.id === id) || null;
  },

  save(event, boatId = null) {
    const events = this.getAll();
    if (event.id) {
      const index = events.findIndex(e => e.id === event.id);
      if (index >= 0) {
        events[index] = { ...event, boat_id: boatId || event.boat_id, updated_at: new Date().toISOString() };
      } else {
        events.push({ ...event, boat_id: boatId || event.boat_id, created_at: new Date().toISOString() });
      }
    } else {
      event.id = `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      event.boat_id = boatId || event.boat_id;
      event.created_at = new Date().toISOString();
      events.push(event);
    }

    // Sort by date (ascending), then time if present
    events.sort((a, b) => {
      const da = new Date(a.date || a.created_at);
      const db = new Date(b.date || b.created_at);
      if (da.getTime() !== db.getTime()) {
        return da - db;
      }
      const ta = a.time || '';
      const tb = b.time || '';
      return ta.localeCompare(tb);
    });

    return storage.set(STORAGE_KEYS.CALENDAR_EVENTS, events);
  },

  delete(id) {
    const events = this.getAll();
    const filtered = events.filter(e => e.id !== id);
    return storage.set(STORAGE_KEYS.CALENDAR_EVENTS, filtered);
  }
};
