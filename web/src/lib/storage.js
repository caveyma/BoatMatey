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
  UPLOADS: 'boatmatey_uploads', // Scoped by boat_id
  CALENDAR_EVENTS: 'boatmatey_calendar_events', // Scoped by boat_id
  SETTINGS: 'boatmatey_settings'
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
    
    const uploads = uploadsStorage.getAll().filter(u => u.boat_id !== boatId);
    storage.set(STORAGE_KEYS.UPLOADS, uploads);
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
    
    // Seed default links if empty for a boat
    if (boatId && links.length === 0) {
      const defaultLinks = [
        { id: `link_navionics_${boatId}`, name: 'Navionics', url: 'https://www.navionics.com', boat_id: boatId },
        { id: `link_metoffice_${boatId}`, name: 'Met Office Marine', url: 'https://www.metoffice.gov.uk/weather/marine', boat_id: boatId },
        { id: `link_windy_${boatId}`, name: 'Windy', url: 'https://www.windy.com', boat_id: boatId },
        { id: `link_marina_${boatId}`, name: 'Local Marina', url: 'https://example.com', boat_id: boatId }
      ];
      links = defaultLinks;
      all.push(...defaultLinks);
      storage.set(STORAGE_KEYS.LINKS, all);
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
