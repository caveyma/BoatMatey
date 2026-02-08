import { supabase } from './supabaseClient.js';
import {
  boatsStorage,
  enginesStorage,
  serviceHistoryStorage,
  hauloutStorage,
  navEquipmentStorage,
  safetyEquipmentStorage,
  shipsLogStorage,
  linksStorage,
  uploadsStorage,
  calendarEventsStorage
} from './storage.js';

// Boat limits (design allows future tiers to override without schema change)
export const BOAT_LIMITS = {
  MAX_ACTIVE_BOATS: 2,
  MAX_ARCHIVED_BOATS: 5,
  MAX_TOTAL_BOATS: 7
};

// Entity types whose files are removed on archive (only service + logbook keep files)
const ARCHIVE_REMOVE_FILE_ENTITY_TYPES = ['boat', 'engine', 'equipment', 'haulout'];

// Log Supabase errors once per resource per session (avoids console spam when tables don't exist)
const _loggedFallbacks = new Set();
function logSupabaseFallback(resource, error) {
  const key = resource;
  if (_loggedFallbacks.has(key)) return;
  _loggedFallbacks.add(key);
  console.warn(
    `[BoatMatey] Cloud sync unavailable for ${resource}.`,
    error?.message || error
  );
}

// Small helper: returns current auth session (or null)
export async function getSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Supabase auth.getSession error:', error);
    return null;
  }
  return data.session ?? null;
}

function isSupabaseEnabled() {
  return !!supabase;
}

// ----------------- Boats -----------------

export async function getBoats() {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    // Local fallback
    return boatsStorage.getAll();
  }

  const localBoats = boatsStorage.getAll();

  const { data, error } = await supabase
    .from('boats')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getBoats error:', error);
    return boatsStorage.getAll().map((b) => ({ ...b, status: b.status || 'active' }));
  }

  // Map DB shape → UI shape
  return data.map((b) => {
    const local = localBoats.find((lb) => lb.id === b.id) || {};
    return {
      id: b.id,
      boat_name: b.name,
      make_model: [b.make, b.model].filter(Boolean).join(' ') || '',
      year: b.year,
      hull_id: b.hull_id,
      length: b.length_m,
      beam: b.beam_m,
      draft: b.draft_m,
      boat_type: b.boat_type ?? 'motor',
      sails_rigging_data: b.sails_rigging_data ?? local.sails_rigging_data ?? null,
      watermaker_installed: b.watermaker_installed ?? local.watermaker_installed ?? false,
      watermaker_data: b.watermaker_data ?? local.watermaker_data ?? null,
      status: b.status ?? 'active',
      created_at: b.created_at,
      updated_at: b.updated_at,
      photo_url: b.photo_url ?? local.photo_url ?? null,
      photo_data: local.photo_data ?? null
    };
  });
}

export async function getBoat(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return boatsStorage.get(boatId);
  }

  const { data, error } = await supabase
    .from('boats')
    .select('*')
    .eq('id', boatId)
    .single();

  if (error || !data) {
    console.error('getBoat error:', error);
    const localBoat = boatsStorage.get(boatId);
    return localBoat ? { ...localBoat, status: localBoat.status || 'active' } : null;
  }

  const local = boatsStorage.get(boatId) || {};
  return {
    id: data.id,
    boat_name: data.name,
    make_model: [data.make, data.model].filter(Boolean).join(' ') || '',
    year: data.year,
    hull_id: data.hull_id,
    length: data.length_m,
    beam: data.beam_m,
    draft: data.draft_m,
    boat_type: data.boat_type ?? 'motor',
    sails_rigging_data: data.sails_rigging_data ?? local.sails_rigging_data ?? null,
    watermaker_installed: data.watermaker_installed ?? local.watermaker_installed ?? false,
    watermaker_data: data.watermaker_data ?? local.watermaker_data ?? null,
    status: data.status ?? 'active',
    created_at: data.created_at,
    updated_at: data.updated_at,
    photo_url: data.photo_url ?? local.photo_url ?? null,
    photo_data: local.photo_data ?? null,
    registration_number: data.registration_number ?? null,
    ssr_number: data.ssr_number ?? null,
    vhf_callsign: data.vhf_callsign ?? null,
    vhf_mmsi: data.vhf_mmsi ?? null,
    last_survey_date: data.last_survey_date ?? null,
    last_surveyor: data.last_surveyor ?? null,
    last_survey_notes: data.last_survey_notes ?? null,
    home_port: data.home_port ?? null,
    fuel_type: data.fuel_type ?? null,
    home_marina: data.home_marina ?? null,
    registration_no: data.registration_no ?? null,
    insurance_provider: data.insurance_provider ?? null,
    insurance_policy_no: data.insurance_policy_no ?? null,
    purchase_date: data.purchase_date ?? null
  };
}

/** Returns true if the boat is archived (read-only). */
export async function isBoatArchived(boatId) {
  if (!boatId) return false;
  const boat = await getBoat(boatId);
  return boat ? (boat.status || 'active') === 'archived' : false;
}

/** Returns { active, archived, total } for current user. Used for limit checks. */
export async function getBoatCounts() {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const all = boatsStorage.getAll();
    const active = all.filter((b) => (b.status || 'active') === 'active').length;
    const archived = all.filter((b) => b.status === 'archived').length;
    return { active, archived, total: all.length };
  }
  const { data, error } = await supabase
    .from('boats')
    .select('status');
  if (error) {
    console.error('getBoatCounts error:', error);
    return { active: 0, archived: 0, total: 0 };
  }
  const active = data.filter((b) => (b.status || 'active') === 'active').length;
  const archived = data.filter((b) => b.status === 'archived').length;
  return { active, archived, total: data.length };
}

export async function createBoat(payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const all = boatsStorage.getAll();
    const activeCount = all.filter((b) => (b.status || 'active') === 'active').length;
    if (all.length >= BOAT_LIMITS.MAX_TOTAL_BOATS) {
      return { error: 'total_limit' };
    }
    if (activeCount >= BOAT_LIMITS.MAX_ACTIVE_BOATS) {
      return { error: 'active_limit' };
    }
    const boat = {
      boat_name: payload.boat_name,
      make_model: payload.make_model,
      boat_type: payload.boat_type ?? 'motor',
      status: 'active'
    };
    boatsStorage.save(boat);
    const created = boatsStorage.getAll().find((b) => b.boat_name === boat.boat_name && b.status === 'active');
    return created ?? boat;
  }

  const counts = await getBoatCounts();
  if (counts.total >= BOAT_LIMITS.MAX_TOTAL_BOATS) {
    return { error: 'total_limit' };
  }
  if (counts.active >= BOAT_LIMITS.MAX_ACTIVE_BOATS) {
    return { error: 'active_limit' };
  }

  const ownerId = session.user.id;
  const { data, error } = await supabase
    .from('boats')
    .insert({
      owner_id: ownerId,
      name: payload.boat_name,
      make: payload.make_model || null,
      model: null,
      year: payload.year ?? null,
      hull_id: payload.hull_id ?? null,
      length_m: payload.length ?? null,
      beam_m: payload.beam ?? null,
      draft_m: payload.draft ?? null,
      boat_type: payload.boat_type ?? 'motor',
      status: 'active'
    })
    .select('*')
    .single();

  if (error) {
    console.error('createBoat error:', error);
  }

  return data ?? null;
}

export async function updateBoat(boatId, payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    // Local fallback updates local boat
    const existing = boatsStorage.get(boatId) || { id: boatId };
    boatsStorage.save({ ...existing, ...payload });
    return;
  }

  const updatePayload = {
    name: payload.boat_name,
    make: payload.make_model || null,
    model: null,
    year: payload.year ?? null,
    hull_id: payload.hull_id ?? null,
    length_m: payload.length ?? null,
    beam_m: payload.beam ?? null,
    draft_m: payload.draft ?? null
  };
  if (payload.boat_type !== undefined) {
    updatePayload.boat_type = payload.boat_type || 'motor';
  }
  if (payload.sails_rigging_data !== undefined) {
    updatePayload.sails_rigging_data = payload.sails_rigging_data;
  }
  if (payload.watermaker_installed !== undefined) {
    updatePayload.watermaker_installed = !!payload.watermaker_installed;
  }
  if (payload.watermaker_data !== undefined) {
    updatePayload.watermaker_data = payload.watermaker_data;
  }
  if (payload.photo_url !== undefined) {
    updatePayload.photo_url = payload.photo_url || null;
  }
  if (payload.registration_number !== undefined) {
    updatePayload.registration_number = payload.registration_number || null;
  }
  if (payload.ssr_number !== undefined) {
    updatePayload.ssr_number = payload.ssr_number || null;
  }
  if (payload.vhf_callsign !== undefined) {
    updatePayload.vhf_callsign = payload.vhf_callsign || null;
  }
  if (payload.vhf_mmsi !== undefined) {
    updatePayload.vhf_mmsi = payload.vhf_mmsi || null;
  }
  if (payload.last_survey_date !== undefined) {
    updatePayload.last_survey_date = payload.last_survey_date || null;
  }
  if (payload.last_surveyor !== undefined) {
    updatePayload.last_surveyor = payload.last_surveyor || null;
  }
  if (payload.last_survey_notes !== undefined) {
    updatePayload.last_survey_notes = payload.last_survey_notes || null;
  }
  if (payload.home_port !== undefined) {
    updatePayload.home_port = payload.home_port || null;
  }
  if (payload.fuel_type !== undefined) {
    updatePayload.fuel_type = payload.fuel_type || null;
  }
  if (payload.home_marina !== undefined) {
    updatePayload.home_marina = payload.home_marina || null;
  }
  if (payload.registration_no !== undefined) {
    updatePayload.registration_no = payload.registration_no || null;
  }
  if (payload.insurance_provider !== undefined) {
    updatePayload.insurance_provider = payload.insurance_provider || null;
  }
  if (payload.insurance_policy_no !== undefined) {
    updatePayload.insurance_policy_no = payload.insurance_policy_no || null;
  }
  if (payload.purchase_date !== undefined) {
    updatePayload.purchase_date = payload.purchase_date || null;
  }

  let result = await supabase
    .from('boats')
    .update(updatePayload)
    .eq('id', boatId);

  // If update fails (e.g. 400 from missing watermaker columns), retry without watermaker fields
  // so boat name, type, etc. still save when migration boat_watermaker.sql has not been run.
  if (result.error) {
    const hasWatermaker = updatePayload.watermaker_installed !== undefined || updatePayload.watermaker_data !== undefined;
    if (hasWatermaker) {
      const { watermaker_installed: _wi, watermaker_data: _wd, ...payloadWithoutWatermaker } = updatePayload;
      result = await supabase
        .from('boats')
        .update(payloadWithoutWatermaker)
        .eq('id', boatId);
    }
    if (result.error) {
      console.error('updateBoat error:', result.error);
    }
  }
}

/**
 * Upload boat photo to Supabase Storage (boat-photos bucket) and return public URL.
 * Caller should then update the boat with photo_url and avoid storing base64 in localStorage.
 */
export async function uploadBoatPhoto(boatId, file) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }

  const bucket = 'boat-photos';
  const userId = session.user.id;
  const ext = (file.name && file.name.split('.').pop()) || 'jpg';
  const path = `${userId}/${boatId}/boat-photo.${ext.replace(/[^a-zA-Z0-9]/g, '')}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: true
    });

  if (uploadError) {
    console.error('Supabase boat photo upload error:', uploadError);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl || null;
}

export async function deleteBoat(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    boatsStorage.delete(boatId);
    return;
  }

  const { error } = await supabase.from('boats').delete().eq('id', boatId);
  if (error) {
    console.error('deleteBoat error:', error);
  }
}

/**
 * Archive a boat: set status to archived, remove files from disallowed sections,
 * remove all link records. Only Service History and Ship's Log keep files.
 */
export async function archiveBoat(boatId) {
  const counts = await getBoatCounts();
  if (counts.archived >= BOAT_LIMITS.MAX_ARCHIVED_BOATS) {
    return { error: 'archived_limit' };
  }

  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const boat = boatsStorage.get(boatId);
    if (!boat) return { error: 'not_found' };
    boatsStorage.save({ ...boat, status: 'archived' });
    linksStorage.getAll(boatId).forEach((link) => linksStorage.delete(link.id));
    const uploads = uploadsStorage.getAll().filter((u) => u.boat_id === boatId && ARCHIVE_REMOVE_FILE_ENTITY_TYPES.includes(u.entity_type));
    uploads.forEach((u) => uploadsStorage.delete(u.id));
    return {};
  }

  const attachments = await listAttachments(boatId);
  const toRemove = attachments.filter((a) => ARCHIVE_REMOVE_FILE_ENTITY_TYPES.includes(a.entity_type));
  const bucket = 'boatmatey-attachments';
  for (const a of toRemove) {
    if (a.path) {
      try {
        await supabase.storage.from(a.bucket || bucket).remove([a.path]);
      } catch (e) {
        console.warn('Archive: could not remove storage object', a.path, e);
      }
    }
  }

  const { error } = await supabase.rpc('archive_boat', { p_boat_id: boatId });
  if (error) {
    console.error('archiveBoat error:', error);
    return { error: error.message };
  }
  return {};
}

/**
 * Reactivate an archived boat. Caller must ensure active count is below limit.
 */
export async function reactivateBoat(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const boat = boatsStorage.get(boatId);
    if (!boat) return { error: 'not_found' };
    const counts = await getBoatCounts();
    if (counts.active >= BOAT_LIMITS.MAX_ACTIVE_BOATS) return { error: 'active_limit' };
    boatsStorage.save({ ...boat, status: 'active' });
    return {};
  }

  const counts = await getBoatCounts();
  if (counts.active >= BOAT_LIMITS.MAX_ACTIVE_BOATS) {
    return { error: 'active_limit' };
  }

  const { error } = await supabase.rpc('reactivate_boat', { p_boat_id: boatId });
  if (error) {
    console.error('reactivateBoat error:', error);
    return { error: error.message };
  }
  return {};
}

// ----------------- Links (boat_links when Supabase) -----------------

/** Default links seeded when a boat has no links (local and Supabase). */
const DEFAULT_LINKS = [
  { name: 'Navionics', url: 'https://www.navionics.com' },
  { name: 'Met Office Marine', url: 'https://www.metoffice.gov.uk/weather/marine' },
  { name: 'Windy', url: 'https://www.windy.com' },
  { name: 'Local Marina', url: 'https://example.com' }
];

export async function getLinks(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return linksStorage.getAll(boatId);
  }
  const { data, error } = await supabase
    .from('boat_links')
    .select('*')
    .eq('boat_id', boatId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('getLinks error:', error);
    return linksStorage.getAll(boatId);
  }
  let rows = data || [];
  // Seed default links when boat has none (same behaviour as local storage)
  if (rows.length === 0) {
    const ownerId = session.user.id;
    const { data: inserted, error: insertError } = await supabase
      .from('boat_links')
      .insert(DEFAULT_LINKS.map((link) => ({
        boat_id: boatId,
        owner_id: ownerId,
        name: link.name,
        url: link.url
      })))
      .select('*')
      .order('created_at', { ascending: true });
    if (!insertError && inserted?.length) {
      rows = inserted;
    }
  }
  const mapped = rows.map((row) => ({ id: row.id, boat_id: boatId, name: row.name, url: row.url, created_at: row.created_at }));
  linksStorage.replaceForBoat(boatId, mapped);
  return mapped;
}

export async function createLink(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const link = { name: payload.name, url: payload.url };
    linksStorage.save(link, boatId);
    return { id: link.id, boat_id: link.boat_id || boatId, name: link.name, url: link.url, created_at: link.created_at };
  }
  const { data, error } = await supabase
    .from('boat_links')
    .insert({
      boat_id: boatId,
      owner_id: session.user.id,
      name: payload.name,
      url: payload.url
    })
    .select('*')
    .single();
  if (error) {
    console.error('createLink error:', error);
    return null;
  }
  return { id: data.id, boat_id: data.boat_id, name: data.name, url: data.url, created_at: data.created_at };
}

export async function updateLink(linkId, boatId, payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const existing = linksStorage.get(linkId);
    if (existing) linksStorage.save({ ...existing, ...payload }, boatId);
    return;
  }
  const { error } = await supabase
    .from('boat_links')
    .update({ name: payload.name, url: payload.url })
    .eq('id', linkId);
  if (error) console.error('updateLink error:', error);
}

export async function deleteLink(linkId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    linksStorage.delete(linkId);
    return;
  }
  const { error } = await supabase.from('boat_links').delete().eq('id', linkId);
  if (error) console.error('deleteLink error:', error);
}

// ----------------- Engines -----------------

export async function getEngines(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return enginesStorage.getAll(boatId);
  }

  const { data, error } = await supabase
    .from('engines')
    .select('*')
    .eq('boat_id', boatId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getEngines error:', error);
    return enginesStorage.getAll(boatId);
  }

  const mapped = (data || []).map((e) => {
    const out = {
      ...e,
      boat_id: boatId,
      manufacturer: e.make,
      serial_number: e.serial,
      horsepower: e.hours,
      label: e.position || [e.make, e.model].filter(Boolean).join(' ') || 'Engine'
    };
    try {
      if (e.notes != null) {
        const d = typeof e.notes === 'string' ? JSON.parse(e.notes) : e.notes;
        if (d && typeof d === 'object') Object.assign(out, d);
      }
    } catch (_) {}
    return out;
  });
  // Sync to local storage so boat dashboard and account Usage show correct counts
  enginesStorage.replaceForBoat(boatId, mapped);
  return mapped;
}

export async function createEngine(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return enginesStorage.save(payload, boatId);
  }

  const { data, error } = await supabase
    .from('engines')
    .insert({
      boat_id: boatId,
      owner_id: session.user.id,
      position: payload.position ?? null,
      make: payload.manufacturer ?? null,
      model: payload.model ?? null,
      serial: payload.serial_number ?? null,
      hours: payload.horsepower ?? null,
      notes: payload.notes ?? null
    })
    .select('*')
    .single();

  if (error) {
    console.error('createEngine error:', error);
    return null;
  }
  if (data) {
    const mapped = {
      ...data,
      boat_id: boatId,
      manufacturer: data.make,
      serial_number: data.serial,
      horsepower: data.hours,
      label: data.position || [data.make, data.model].filter(Boolean).join(' ') || 'Engine'
    };
    try {
      if (data.notes != null) {
        const d = typeof data.notes === 'string' ? JSON.parse(data.notes) : data.notes;
        if (d && typeof d === 'object') Object.assign(mapped, d);
      }
    } catch (_) {}
    enginesStorage.save(mapped, boatId);
  }
  return data ?? null;
}

export async function updateEngine(engineId, payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const existing = enginesStorage.get(engineId) || { id: engineId };
    enginesStorage.save({ ...existing, ...payload }, existing.boat_id);
    return;
  }

  const { error } = await supabase
    .from('engines')
    .update({
      position: payload.position ?? null,
      make: payload.manufacturer ?? null,
      model: payload.model ?? null,
      serial: payload.serial_number ?? null,
      hours: payload.horsepower ?? null,
      notes: payload.notes ?? null
    })
    .eq('id', engineId);

  if (error) {
    console.error('updateEngine error:', error);
  } else {
    const existing = enginesStorage.get(engineId);
    if (existing) {
      const notesObj = typeof payload.notes === 'string' && payload.notes.startsWith('{') ? (() => { try { return JSON.parse(payload.notes); } catch (_) { return {}; } })() : {};
      enginesStorage.save({ ...existing, ...payload, ...notesObj }, existing.boat_id);
    }
  }
}

export async function deleteEngine(engineId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    enginesStorage.delete(engineId);
    return;
  }

  const { error } = await supabase.from('engines').delete().eq('id', engineId);
  if (error) {
    console.error('deleteEngine error:', error);
  } else {
    enginesStorage.delete(engineId);
  }
}

// ----------------- Service entries -----------------

export async function getServiceEntries(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return serviceHistoryStorage.getAll(boatId);
  }

  const { data, error } = await supabase
    .from('service_entries')
    .select('*')
    .eq('boat_id', boatId)
    .order('service_date', { ascending: false });

  if (error) {
    console.error('getServiceEntries error:', error);
    return serviceHistoryStorage.getAll(boatId);
  }

  const mapped = (data || []).map((e) => {
    const out = { ...e, boat_id: boatId, date: e.service_date, service_type: e.title, notes: e.description };
    try {
      if (e.description && typeof e.description === 'string' && (e.description.startsWith('{') || e.description.startsWith('['))) {
        const d = JSON.parse(e.description);
        if (d && typeof d === 'object' && !Array.isArray(d)) Object.assign(out, d);
      }
    } catch (_) {}
    return out;
  });
  serviceHistoryStorage.replaceForBoat(boatId, mapped);
  return mapped;
}

export async function createServiceEntry(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return serviceHistoryStorage.save(payload, boatId);
  }

  const { data, error } = await supabase
    .from('service_entries')
    .insert({
      boat_id: boatId,
      engine_id: payload.engine_id ?? null,
      owner_id: session.user.id,
      service_date: payload.date,
      title: payload.service_type || 'Service',
      description: payload.notes ?? null,
      cost: payload.cost ?? null,
      provider: payload.provider ?? null
    })
    .select('*')
    .single();

  if (error) {
    console.error('createServiceEntry error:', error);
  }

  return data ?? null;
}

export async function updateServiceEntry(serviceId, payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const existing = serviceHistoryStorage.get(serviceId) || { id: serviceId };
    serviceHistoryStorage.save({ ...existing, ...payload }, existing.boat_id);
    return;
  }

  const { error } = await supabase
    .from('service_entries')
    .update({
      engine_id: payload.engine_id ?? null,
      service_date: payload.date,
      title: payload.service_type || 'Service',
      description: payload.notes ?? null,
      cost: payload.cost ?? null,
      provider: payload.provider ?? null
    })
    .eq('id', serviceId);

  if (error) {
    console.error('updateServiceEntry error:', error);
  }
}

export async function deleteServiceEntry(serviceId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    serviceHistoryStorage.delete(serviceId);
    return;
  }

  const { error } = await supabase
    .from('service_entries')
    .delete()
    .eq('id', serviceId);
  if (error) {
    console.error('deleteServiceEntry error:', error);
  }
}

// ----------------- Equipment (navigation / safety) -----------------

export async function getEquipment(boatId, category) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    if (category === 'navigation') return navEquipmentStorage.getAll(boatId);
    if (category === 'safety') return safetyEquipmentStorage.getAll(boatId);
    return [];
  }

  const { data, error } = await supabase
    .from('equipment_items')
    .select('*')
    .eq('boat_id', boatId)
    .eq('category', category)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getEquipment error:', error);
    if (category === 'navigation') return navEquipmentStorage.getAll(boatId);
    if (category === 'safety') return safetyEquipmentStorage.getAll(boatId);
    return [];
  }

  const mapped = (data || []).map((item) => {
    const out = { ...item, boat_id: boatId, notes: item.details };
    try {
      if (item.details && typeof item.details === 'string') {
        const d = JSON.parse(item.details);
        if (d && typeof d === 'object') Object.assign(out, d);
      }
    } catch (_) {}
    return out;
  });
  if (category === 'navigation') navEquipmentStorage.replaceForBoat(boatId, mapped);
  if (category === 'safety') safetyEquipmentStorage.replaceForBoat(boatId, mapped);
  return mapped;
}

export async function createEquipment(boatId, category, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    if (category === 'navigation') return navEquipmentStorage.save(payload, boatId);
    if (category === 'safety') return safetyEquipmentStorage.save(payload, boatId);
    return null;
  }

  const detailsObj = category === 'safety'
    ? { type: payload.type, serial_number: payload.serial_number, service_interval: payload.service_interval, notes: payload.notes }
    : { manufacturer: payload.manufacturer, model: payload.model, serial_number: payload.serial_number, install_date: payload.install_date, warranty_expiry_date: payload.warranty_expiry_date, warranty_reminder_minutes: payload.warranty_reminder_minutes ?? null, notes: payload.notes };
  const detailsStr = Object.keys(detailsObj).some((k) => detailsObj[k] != null) ? JSON.stringify(detailsObj) : (payload.notes || null);
  const expiry = category === 'safety' ? (payload.expiry_date ?? null) : (payload.warranty_expiry_date ?? null);

  const { data, error } = await supabase
    .from('equipment_items')
    .insert({
      boat_id: boatId,
      owner_id: session.user.id,
      category,
      name: payload.name,
      quantity: payload.quantity ?? 1,
      details: detailsStr,
      expiry_date: expiry
    })
    .select('*')
    .single();

  if (error) {
    console.error('createEquipment error:', error);
  }

  return data ?? null;
}

export async function updateEquipment(equipmentId, category, payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    if (category === 'navigation') {
      const existing = navEquipmentStorage.get(equipmentId) || { id: equipmentId };
      navEquipmentStorage.save({ ...existing, ...payload }, existing.boat_id);
    } else if (category === 'safety') {
      const existing = safetyEquipmentStorage.get(equipmentId) || { id: equipmentId };
      safetyEquipmentStorage.save({ ...existing, ...payload }, existing.boat_id);
    }
    return;
  }

  const detailsObj = category === 'safety'
    ? { type: payload.type, serial_number: payload.serial_number, service_interval: payload.service_interval, notes: payload.notes }
    : { manufacturer: payload.manufacturer, model: payload.model, serial_number: payload.serial_number, install_date: payload.install_date, warranty_expiry_date: payload.warranty_expiry_date, warranty_reminder_minutes: payload.warranty_reminder_minutes ?? null, notes: payload.notes };
  const detailsStr = Object.keys(detailsObj).some((k) => detailsObj[k] != null) ? JSON.stringify(detailsObj) : (payload.notes || null);
  const expiry = category === 'safety' ? (payload.expiry_date ?? null) : (payload.warranty_expiry_date ?? null);

  const { error } = await supabase
    .from('equipment_items')
    .update({
      name: payload.name,
      quantity: payload.quantity ?? 1,
      details: detailsStr,
      expiry_date: expiry
    })
    .eq('id', equipmentId)
    .eq('category', category);

  if (error) {
    console.error('updateEquipment error:', error);
  }
}

export async function deleteEquipment(equipmentId, category) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    if (category === 'navigation') navEquipmentStorage.delete(equipmentId);
    if (category === 'safety') safetyEquipmentStorage.delete(equipmentId);
    return;
  }

  const { error } = await supabase
    .from('equipment_items')
    .delete()
    .eq('id', equipmentId)
    .eq('category', category);
  if (error) {
    console.error('deleteEquipment error:', error);
  }
}

// ----------------- Logbook -----------------

export async function getLogbook(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return shipsLogStorage.getAll(boatId);
  }

  const { data, error } = await supabase
    .from('logbook_entries')
    .select('*')
    .eq('boat_id', boatId)
    .order('trip_date', { ascending: false });

  if (error) {
    console.error('getLogbook error:', error);
    return shipsLogStorage.getAll(boatId);
  }

  const mapped = (data || []).map((e) => {
    const out = { ...e, boat_id: boatId, date: e.trip_date, departure: e.from_location, arrival: e.to_location };
    try {
      if (e.notes && typeof e.notes === 'string') {
        const d = JSON.parse(e.notes);
        if (d && typeof d === 'object') {
          if (d.raw != null) out.notes = d.raw;
          if (d.engine_hours_start != null) out.engine_hours_start = d.engine_hours_start;
          if (d.engine_hours_end != null) out.engine_hours_end = d.engine_hours_end;
          if (d.distance_nm != null) out.distance_nm = d.distance_nm;
        }
      }
    } catch (_) {}
    return out;
  });
  shipsLogStorage.replaceForBoat(boatId, mapped);
  return mapped;
}

export async function createLogEntry(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return shipsLogStorage.save(payload, boatId);
  }

  const { data, error } = await supabase
    .from('logbook_entries')
    .insert({
      boat_id: boatId,
      owner_id: session.user.id,
      trip_date: payload.date || payload.trip_date,
      title: payload.title ?? 'Trip',
      notes: payload.notes ?? null,
      hours: payload.hours ?? null,
      from_location: payload.from_location ?? payload.departure ?? null,
      to_location: payload.to_location ?? payload.arrival ?? null
    })
    .select('*')
    .single();

  if (error) {
    console.error('createLogEntry error:', error);
  }

  return data ?? null;
}

export async function updateLogEntry(logId, payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const existing = shipsLogStorage.get(logId) || { id: logId };
    shipsLogStorage.save({ ...existing, ...payload }, existing.boat_id);
    return;
  }

  const { error } = await supabase
    .from('logbook_entries')
    .update({
      trip_date: payload.date ?? payload.trip_date,
      title: payload.title ?? 'Trip',
      notes: payload.notes ?? null,
      hours: payload.hours ?? null,
      from_location: payload.from_location ?? payload.departure ?? null,
      to_location: payload.to_location ?? payload.arrival ?? null
    })
    .eq('id', logId);

  if (error) {
    console.error('updateLogEntry error:', error);
  }
}

export async function deleteLogEntry(logId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    shipsLogStorage.delete(logId);
    return;
  }

  const { error } = await supabase
    .from('logbook_entries')
    .delete()
    .eq('id', logId);
  if (error) {
    console.error('deleteLogEntry error:', error);
  }
}

// ----------------- Haulout entries -----------------

export async function getHaulouts(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return hauloutStorage.getAll(boatId);
  }

  const { data, error } = await supabase
    .from('haulout_entries')
    .select('*')
    .eq('boat_id', boatId)
    .order('haulout_date', { ascending: false });

  if (error) {
    logSupabaseFallback('haulout_entries', error);
    return hauloutStorage.getAll(boatId);
  }

  const list = (data || []).map((row) => ({ ...row, boat_id: boatId }));
  hauloutStorage.replaceForBoat(boatId, list);
  return list;
}

export async function createHaulout(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const saved = hauloutStorage.save(payload, boatId);
    return saved ? hauloutStorage.getAll(boatId).find((e) => e.haulout_date === payload.haulout_date) : null;
  }

  const row = {
    boat_id: boatId,
    owner_id: session.user.id,
    haulout_date: payload.haulout_date,
    launch_date: payload.launch_date || null,
    yard_marina: payload.yard_marina || null,
    reason_for_liftout: payload.reason_for_liftout || null,
    antifoul_brand: payload.antifoul_brand || null,
    antifoul_product_name: payload.antifoul_product_name || null,
    antifoul_type: payload.antifoul_type || null,
    antifoul_colour: payload.antifoul_colour || null,
    antifoul_coats: payload.antifoul_coats ?? null,
    antifoul_last_stripped_blasted: payload.antifoul_last_stripped_blasted ?? null,
    antifoul_applied_by: payload.antifoul_applied_by || null,
    anode_material: payload.anode_material || null,
    anodes_replaced: payload.anodes_replaced ?? null,
    anode_locations: payload.anode_locations || null,
    old_anode_condition: payload.old_anode_condition || null,
    props_condition: payload.props_condition || null,
    props_serviced: payload.props_serviced ?? null,
    shaft_condition: payload.shaft_condition || null,
    shaft_issues: payload.shaft_issues || null,
    cutless_bearings_checked: payload.cutless_bearings_checked || null,
    rudder_steering_checked: payload.rudder_steering_checked || null,
    rudder_steering_issues: payload.rudder_steering_issues || null,
    seacocks_inspected: payload.seacocks_inspected || null,
    seacocks_replaced: payload.seacocks_replaced ?? null,
    seacock_material: payload.seacock_material || null,
    seacocks_issues: payload.seacocks_issues || null,
    hull_condition: payload.hull_condition || null,
    osmosis_check: payload.osmosis_check || null,
    keel_skeg_trim_tabs_checked: payload.keel_skeg_trim_tabs_checked || null,
    hull_issues: payload.hull_issues || null,
    osmosis_notes: payload.osmosis_notes || null,
    keel_skeg_trim_tabs_notes: payload.keel_skeg_trim_tabs_notes || null,
    yard_contractor_name: payload.yard_contractor_name || null,
    total_cost: payload.total_cost ?? null,
    general_notes: payload.general_notes || null,
    recommendations_next_haulout: payload.recommendations_next_haulout || null,
    next_haulout_due: payload.next_haulout_due || null,
    next_haulout_reminder_minutes: payload.next_haulout_reminder_minutes ?? null
  };

  const { data, error } = await supabase
    .from('haulout_entries')
    .insert(row)
    .select('*')
    .single();

  if (error) {
    logSupabaseFallback('haulout_entries', error);
    return null;
  }
  return data;
}

export async function updateHaulout(hauloutId, payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const existing = hauloutStorage.get(hauloutId) || { id: hauloutId };
    hauloutStorage.save({ ...existing, ...payload }, existing.boat_id);
    return;
  }

  const updateRow = {
    haulout_date: payload.haulout_date,
    launch_date: payload.launch_date ?? null,
    yard_marina: payload.yard_marina ?? null,
    reason_for_liftout: payload.reason_for_liftout ?? null,
    antifoul_brand: payload.antifoul_brand ?? null,
    antifoul_product_name: payload.antifoul_product_name ?? null,
    antifoul_type: payload.antifoul_type ?? null,
    antifoul_colour: payload.antifoul_colour ?? null,
    antifoul_coats: payload.antifoul_coats ?? null,
    antifoul_last_stripped_blasted: payload.antifoul_last_stripped_blasted ?? null,
    antifoul_applied_by: payload.antifoul_applied_by ?? null,
    anode_material: payload.anode_material ?? null,
    anodes_replaced: payload.anodes_replaced ?? null,
    anode_locations: payload.anode_locations ?? null,
    old_anode_condition: payload.old_anode_condition ?? null,
    props_condition: payload.props_condition ?? null,
    props_serviced: payload.props_serviced ?? null,
    shaft_condition: payload.shaft_condition ?? null,
    shaft_issues: payload.shaft_issues ?? null,
    cutless_bearings_checked: payload.cutless_bearings_checked ?? null,
    rudder_steering_checked: payload.rudder_steering_checked ?? null,
    rudder_steering_issues: payload.rudder_steering_issues ?? null,
    seacocks_inspected: payload.seacocks_inspected ?? null,
    seacocks_replaced: payload.seacocks_replaced ?? null,
    seacock_material: payload.seacock_material ?? null,
    seacocks_issues: payload.seacocks_issues ?? null,
    hull_condition: payload.hull_condition ?? null,
    osmosis_check: payload.osmosis_check ?? null,
    keel_skeg_trim_tabs_checked: payload.keel_skeg_trim_tabs_checked ?? null,
    hull_issues: payload.hull_issues ?? null,
    osmosis_notes: payload.osmosis_notes ?? null,
    keel_skeg_trim_tabs_notes: payload.keel_skeg_trim_tabs_notes ?? null,
    yard_contractor_name: payload.yard_contractor_name ?? null,
    total_cost: payload.total_cost ?? null,
    general_notes: payload.general_notes ?? null,
    recommendations_next_haulout: payload.recommendations_next_haulout ?? null,
    next_haulout_due: payload.next_haulout_due ?? null,
    next_haulout_reminder_minutes: payload.next_haulout_reminder_minutes ?? null
  };

  const { error } = await supabase
    .from('haulout_entries')
    .update(updateRow)
    .eq('id', hauloutId);

  if (error) {
    logSupabaseFallback('haulout_entries', error);
  }
}

export async function deleteHaulout(hauloutId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    hauloutStorage.delete(hauloutId);
    return;
  }

  const { error } = await supabase
    .from('haulout_entries')
    .delete()
    .eq('id', hauloutId);
  if (error) {
    logSupabaseFallback('haulout_entries', error);
  }
}

// ----------------- Calendar events -----------------

export async function getCalendarEvents(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return calendarEventsStorage.getAll(boatId);
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('boat_id', boatId)
    .order('date', { ascending: true });

  if (error) {
    logSupabaseFallback('calendar_events', error);
    return calendarEventsStorage.getAll(boatId);
  }

  return (data || []).map((e) => ({
    ...e,
    time: e.time ? (typeof e.time === 'string' ? e.time.slice(0, 5) : e.time) : null
  }));
}

export async function createCalendarEvent(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  const dbPayload = {
    boat_id: boatId,
    owner_id: session?.user?.id,
    date: payload.date,
    time: payload.time || null,
    title: payload.title,
    notes: payload.notes || null,
    repeat: payload.repeat || null,
    repeat_until: payload.repeat_until || null,
    reminder_minutes: payload.reminder_minutes ?? null
  };

  if (!session || !isSupabaseEnabled()) {
    const event = { ...payload, boat_id: boatId };
    calendarEventsStorage.save(event, boatId);
    return calendarEventsStorage.getAll(boatId).find((e) => e.date === payload.date && e.title === payload.title) || event;
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert(dbPayload)
    .select('*')
    .single();

  if (error) {
    logSupabaseFallback('calendar_events', error);
    // Fall back to local storage when Supabase fails (e.g. table not migrated)
    const event = { ...payload, boat_id: boatId };
    calendarEventsStorage.save(event, boatId);
    return calendarEventsStorage.getAll(boatId).find((e) => e.date === payload.date && e.title === payload.title) || event;
  }
  return data;
}

export async function updateCalendarEvent(eventId, payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    const existing = calendarEventsStorage.get(eventId) || { id: eventId };
    calendarEventsStorage.save({ ...existing, ...payload }, existing.boat_id);
    return;
  }

  const { error } = await supabase
    .from('calendar_events')
    .update({
      date: payload.date,
      time: payload.time ?? null,
      title: payload.title,
      notes: payload.notes ?? null,
      repeat: payload.repeat ?? null,
      repeat_until: payload.repeat_until ?? null,
      reminder_minutes: payload.reminder_minutes ?? null
    })
    .eq('id', eventId);

  if (error) {
    logSupabaseFallback('calendar_events', error);
    const existing = calendarEventsStorage.get(eventId) || { id: eventId };
    calendarEventsStorage.save({ ...existing, ...payload }, existing.boat_id);
  }
}

export async function deleteCalendarEvent(eventId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    calendarEventsStorage.delete(eventId);
    return;
  }

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', eventId);
  if (error) {
    logSupabaseFallback('calendar_events', error);
    calendarEventsStorage.delete(eventId);
  }
}

// ----------------- Attachments / Storage -----------------

export async function uploadAttachment(boatId, file, entityType, entityId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }

  if (await isBoatArchived(boatId)) {
    return null;
  }

  const bucket = 'boatmatey-attachments';
  const userId = session.user.id;
  const uuid = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : String(Date.now());
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const path = `${userId}/${boatId}/${uuid}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    console.error('Supabase storage upload error:', uploadError);
    return null;
  }

  const { data, error } = await supabase
    .from('attachments')
    .insert({
      boat_id: boatId,
      owner_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      bucket,
      path,
      filename: file.name,
      content_type: file.type,
      size_bytes: file.size
    })
    .select('*')
    .single();

  if (error) {
    console.error('attachments insert error:', error);
  }

  return data ?? null;
}

export async function listAttachments(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return [];
  }

  const { data, error } = await supabase
    .from('attachments')
    .select('*')
    .eq('boat_id', boatId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('listAttachments error:', error);
    return [];
  }

  return data;
}

// ----------------- Fuel & Performance -----------------

export async function getFuelPerformance(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }
  const { data, error } = await supabase
    .from('boat_fuel_performance')
    .select('*')
    .eq('boat_id', boatId)
    .maybeSingle();
  if (error) {
    logSupabaseFallback('boat_fuel_performance', error);
    return null;
  }
  return data;
}

export async function upsertFuelPerformance(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }
  const row = {
    boat_id: boatId,
    user_id: session.user.id,
    preferred_units: payload.preferred_units ?? 'litres',
    typical_cruise_rpm: payload.typical_cruise_rpm ?? null,
    typical_cruise_speed_kn: payload.typical_cruise_speed_kn ?? null,
    typical_burn_lph: payload.typical_burn_lph ?? null,
    fuel_tank_capacity_litres: payload.fuel_tank_capacity_litres ?? null,
    usable_fuel_litres: payload.usable_fuel_litres ?? null,
    notes: payload.notes ?? null
  };
  const { data, error } = await supabase
    .from('boat_fuel_performance')
    .upsert(row, { onConflict: 'boat_id' })
    .select('*')
    .single();
  if (error) {
    logSupabaseFallback('boat_fuel_performance', error);
    return null;
  }
  return data;
}

export async function getFuelLogs(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return [];
  }
  const { data, error } = await supabase
    .from('boat_fuel_logs')
    .select('*')
    .eq('boat_id', boatId)
    .order('log_date', { ascending: false });
  if (error) {
    logSupabaseFallback('boat_fuel_logs', error);
    return [];
  }
  return data || [];
}

export async function createFuelLog(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }
  const { data, error } = await supabase
    .from('boat_fuel_logs')
    .insert({
      boat_id: boatId,
      user_id: session.user.id,
      log_date: payload.log_date,
      engine_hours: payload.engine_hours ?? null,
      fuel_added_litres: payload.fuel_added_litres ?? null,
      fuel_cost: payload.fuel_cost ?? null,
      distance_nm: payload.distance_nm ?? null,
      avg_speed_kn: payload.avg_speed_kn ?? null,
      notes: payload.notes ?? null
    })
    .select('*')
    .single();
  if (error) {
    logSupabaseFallback('boat_fuel_logs', error);
    return null;
  }
  return data;
}

export async function updateFuelLog(logId, payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }
  const { error } = await supabase
    .from('boat_fuel_logs')
    .update({
      log_date: payload.log_date,
      engine_hours: payload.engine_hours ?? null,
      fuel_added_litres: payload.fuel_added_litres ?? null,
      fuel_cost: payload.fuel_cost ?? null,
      distance_nm: payload.distance_nm ?? null,
      avg_speed_kn: payload.avg_speed_kn ?? null,
      notes: payload.notes ?? null
    })
    .eq('id', logId);
  if (error) {
    logSupabaseFallback('boat_fuel_logs', error);
  }
}

export async function deleteFuelLog(logId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return;
  }
  const { error } = await supabase.from('boat_fuel_logs').delete().eq('id', logId);
  if (error) {
    logSupabaseFallback('boat_fuel_logs', error);
  }
}

// ----------------- Electrical & Batteries -----------------

export async function getBoatElectrical(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }
  const { data, error } = await supabase
    .from('boat_electrical')
    .select('*')
    .eq('boat_id', boatId)
    .maybeSingle();
  if (error) {
    logSupabaseFallback('boat_electrical', error);
    return null;
  }
  return data;
}

export async function upsertBoatElectrical(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }
  const row = {
    boat_id: boatId,
    user_id: session.user.id,
    system_voltage: payload.system_voltage ?? null,
    shore_power: payload.shore_power ?? null,
    inverter: payload.inverter ?? null,
    inverter_brand: payload.inverter_brand ?? null,
    charger_brand: payload.charger_brand ?? null,
    solar: payload.solar ?? null,
    solar_watts: payload.solar_watts ?? null,
    generator: payload.generator ?? null,
    generator_brand: payload.generator_brand ?? null,
    notes: payload.notes ?? null
  };
  const { data, error } = await supabase
    .from('boat_electrical')
    .upsert(row, { onConflict: 'boat_id' })
    .select('*')
    .single();
  if (error) {
    logSupabaseFallback('boat_electrical', error);
    return null;
  }
  return data;
}

export async function getBatteries(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return [];
  }
  const { data, error } = await supabase
    .from('boat_batteries')
    .select('*')
    .eq('boat_id', boatId)
    .order('created_at', { ascending: true });
  if (error) {
    logSupabaseFallback('boat_batteries', error);
    return [];
  }
  return data || [];
}

export async function createBattery(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }
  const { data, error } = await supabase
    .from('boat_batteries')
    .insert({
      boat_id: boatId,
      user_id: session.user.id,
      battery_name: payload.battery_name,
      battery_type: payload.battery_type ?? null,
      capacity_ah: payload.capacity_ah ?? null,
      quantity: payload.quantity ?? 1,
      installed_date: payload.installed_date ?? null,
      last_test_date: payload.last_test_date ?? null,
      last_test_notes: payload.last_test_notes ?? null,
      replaced_date: payload.replaced_date ?? null,
      notes: payload.notes ?? null
    })
    .select('*')
    .single();
  if (error) {
    logSupabaseFallback('boat_batteries', error);
    return null;
  }
  return data;
}

export async function updateBattery(batteryId, payload) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return;
  }
  const { error } = await supabase
    .from('boat_batteries')
    .update({
      battery_name: payload.battery_name,
      battery_type: payload.battery_type ?? null,
      capacity_ah: payload.capacity_ah ?? null,
      quantity: payload.quantity ?? 1,
      installed_date: payload.installed_date ?? null,
      last_test_date: payload.last_test_date ?? null,
      last_test_notes: payload.last_test_notes ?? null,
      replaced_date: payload.replaced_date ?? null,
      notes: payload.notes ?? null
    })
    .eq('id', batteryId);
  if (error) {
    logSupabaseFallback('boat_batteries', error);
  }
}

export async function deleteBattery(batteryId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return;
  }
  const { error } = await supabase.from('boat_batteries').delete().eq('id', batteryId);
  if (error) {
    logSupabaseFallback('boat_batteries', error);
  }
}

// ----------------- Mayday / Distress Info -----------------

export async function getBoatDistressInfo(boatId) {
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }
  const { data, error } = await supabase
    .from('boat_distress_info')
    .select('*')
    .eq('boat_id', boatId)
    .maybeSingle();
  if (error) {
    logSupabaseFallback('boat_distress_info', error);
    return null;
  }
  return data;
}

export async function upsertBoatDistressInfo(boatId, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    return null;
  }
  const vesselName = (payload.vessel_name || '').trim();
  if (!vesselName) {
    return { error: 'vessel_name_required' };
  }
  const row = {
    boat_id: boatId,
    user_id: session.user.id,
    vessel_name: vesselName,
    vessel_name_phonetic: payload.vessel_name_phonetic?.trim() || null,
    callsign: payload.callsign?.trim() || null,
    callsign_phonetic: payload.callsign_phonetic?.trim() || null,
    mmsi: payload.mmsi?.trim() || null,
    persons_on_board: payload.persons_on_board != null ? parseInt(payload.persons_on_board, 10) : null,
    skipper_name: payload.skipper_name?.trim() || null,
    skipper_mobile: payload.skipper_mobile?.trim() || null,
    emergency_contact_name: payload.emergency_contact_name?.trim() || null,
    emergency_contact_phone: payload.emergency_contact_phone?.trim() || null,
    vessel_type: payload.vessel_type?.trim() || null,
    hull_colour: payload.hull_colour?.trim() || null,
    length_m: payload.length_m != null ? parseFloat(payload.length_m) : null,
    distinguishing_features: payload.distinguishing_features?.trim() || null,
    liferaft: payload.liferaft ?? null,
    epirb: payload.epirb ?? null,
    epirb_hex_id: payload.epirb_hex_id?.trim() || null,
    plb: payload.plb ?? null,
    ais: payload.ais ?? null,
    home_port: payload.home_port?.trim() || null,
    usual_area: payload.usual_area?.trim() || null,
    notes: payload.notes?.trim() || null
  };
  const { data, error } = await supabase
    .from('boat_distress_info')
    .upsert(row, { onConflict: 'boat_id' })
    .select('*')
    .single();
  if (error) {
    logSupabaseFallback('boat_distress_info', error);
    return null;
  }
  return data;
}

