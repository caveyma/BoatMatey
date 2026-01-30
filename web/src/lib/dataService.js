import { supabase } from './supabaseClient.js';
import {
  boatsStorage,
  enginesStorage,
  serviceHistoryStorage,
  navEquipmentStorage,
  safetyEquipmentStorage,
  shipsLogStorage,
  linksStorage,
  uploadsStorage
} from './storage.js';

// Boat limits (design allows future tiers to override without schema change)
export const BOAT_LIMITS = {
  MAX_ACTIVE_BOATS: 2,
  MAX_ARCHIVED_BOATS: 5,
  MAX_TOTAL_BOATS: 7
};

// Entity types whose files are removed on archive (only service + logbook keep files)
const ARCHIVE_REMOVE_FILE_ENTITY_TYPES = ['boat', 'engine', 'equipment', 'haulout'];

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
    status: data.status ?? 'active',
    created_at: data.created_at,
    updated_at: data.updated_at,
    photo_url: data.photo_url ?? local.photo_url ?? null,
    photo_data: local.photo_data ?? null
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
    if (all.length >= BOAT_LIMITS.MAX_TOTAL_BOATS) {
      return { error: 'total_limit' };
    }
    const boat = {
      boat_name: payload.boat_name,
      make_model: payload.make_model,
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
  if (payload.photo_url !== undefined) {
    updatePayload.photo_url = payload.photo_url || null;
  }

  const { error } = await supabase
    .from('boats')
    .update(updatePayload)
    .eq('id', boatId);

  if (error) {
    console.error('updateBoat error:', error);
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
  return (data || []).map((row) => ({ id: row.id, boat_id: row.boat_id, name: row.name, url: row.url, created_at: row.created_at }));
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

  return data;
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

  return data;
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

  return data;
}

export async function createEquipment(boatId, category, payload) {
  if (await isBoatArchived(boatId)) return null;
  const session = await getSession();
  if (!session || !isSupabaseEnabled()) {
    if (category === 'navigation') return navEquipmentStorage.save(payload, boatId);
    if (category === 'safety') return safetyEquipmentStorage.save(payload, boatId);
    return null;
  }

  const { data, error } = await supabase
    .from('equipment_items')
    .insert({
      boat_id: boatId,
      owner_id: session.user.id,
      category,
      name: payload.name,
      quantity: payload.quantity ?? 1,
      details: payload.notes ?? null,
      expiry_date: payload.expiry_date ?? null
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

  const { error } = await supabase
    .from('equipment_items')
    .update({
      name: payload.name,
      quantity: payload.quantity ?? 1,
      details: payload.notes ?? null,
      expiry_date: payload.expiry_date ?? null
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

  return data;
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
      trip_date: payload.date,
      title: payload.title ?? 'Trip',
      notes: payload.notes ?? null,
      hours: payload.hours ?? null,
      from_location: payload.from_location ?? null,
      to_location: payload.to_location ?? null
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
      trip_date: payload.date,
      title: payload.title ?? 'Trip',
      notes: payload.notes ?? null,
      hours: payload.hours ?? null,
      from_location: payload.from_location ?? null,
      to_location: payload.to_location ?? null
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

