/**
 * File upload/attachment handling
 * For now stores metadata + base64 for small images
 * Future: integrate with Capacitor filesystem for native apps
 */

import { uploadsStorage } from './storage.js';
import { uploadAttachment, listAttachments } from './dataService.js';
import { supabase } from './supabaseClient.js';

const MAX_BASE64_SIZE = 500 * 1024; // 500KB - only store small images as base64

// Default limits for uploads (used by most cards/pages)
export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5MB per file
export const MAX_UPLOADS_PER_ENTITY = 5; // Max files per card/entity

// Stricter limits for per-record attachments (service entries, nav items, safety items)
export const LIMITED_UPLOAD_SIZE_BYTES = 2 * 1024 * 1024; // 2MB per file
export const LIMITED_UPLOADS_PER_ENTITY = 2; // Max 2 files per record

/**
 * Convert file to base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Save an uploaded file
 */
export async function saveUpload(file, entityType, entityId, boatId = null) {
  const isImage = file.type.startsWith('image/');
  const size = file.size;
  
  let data = null;
  let storageType = 'reference'; // Future: use filesystem path

  // Only store small images as base64
  if (isImage && size <= MAX_BASE64_SIZE) {
    try {
      data = await fileToBase64(file);
      storageType = 'base64';
    } catch (e) {
      console.error('Error converting file to base64:', e);
    }
  }

  const upload = {
    filename: file.name,
    mime_type: file.type,
    size: size,
    entity_type: entityType,
    entity_id: entityId,
    storage_type: storageType,
    data: data, // base64 for small images, null otherwise
    created_at: new Date().toISOString()
  };

  uploadsStorage.save(upload, boatId);

  // Also send to Supabase Storage + attachments table when configured.
  if (boatId) {
    try {
      const cloudAttachment = await uploadAttachment(boatId, file, entityType, entityId);
      if (cloudAttachment?.path) {
        upload.cloud_attachment_id = cloudAttachment.id || null;
        upload.bucket = cloudAttachment.bucket || 'boatmatey-attachments';
        upload.path = cloudAttachment.path;
        upload.storage_type = upload.storage_type === 'base64' ? 'base64' : 'cloud';
        uploadsStorage.save(upload, boatId);
      }
    } catch (e) {
      console.error('Supabase uploadAttachment error (local copy kept):', e);
    }
  }

  return upload;
}

/**
 * Save a link attachment associated with an entity
 */
export function saveLinkAttachment(name, url, entityType, entityId, boatId = null) {
  if (!url) return null;

  const upload = {
    filename: name || url,
    mime_type: 'text/url',
    size: 0,
    entity_type: entityType,
    entity_id: entityId,
    storage_type: 'link',
    data: null,
    url,
    created_at: new Date().toISOString()
  };

  uploadsStorage.save(upload, boatId);
  return upload;
}

/**
 * Get uploads for an entity
 */
export function getUploads(entityType, entityId, boatId = null) {
  return uploadsStorage.getByEntity(entityType, entityId, boatId);
}

/**
 * Delete an upload
 */
export function deleteUpload(uploadId) {
  return uploadsStorage.delete(uploadId);
}

/**
 * Get upload by ID
 */
export function getUpload(uploadId) {
  return uploadsStorage.get(uploadId);
}

export async function refreshBoatUploadsFromCloud(boatId) {
  if (!boatId) return;
  try {
    const cloud = await listAttachments(boatId);
    if (!Array.isArray(cloud) || !cloud.length) return;

    const localUploads = uploadsStorage.getAll().filter((u) => u.boat_id === boatId);

    cloud.forEach((a) => {
      if (!a?.path || !a?.entity_type || !a?.entity_id) return;

      const existing = localUploads.find((u) => {
        if (u.path && u.path === a.path) return true;
        if (u.cloud_attachment_id && a.id && u.cloud_attachment_id === a.id) return true;
        if (u.entity_type !== a.entity_type) return false;
        if (String(u.entity_id) !== String(a.entity_id)) return false;
        if (u.filename && a.filename && u.filename === a.filename) return true;
        return typeof u.size === 'number' && typeof a.size_bytes === 'number' && u.size === a.size_bytes;
      });

      const merged = {
        ...(existing || {}),
        filename: a.filename || existing?.filename || 'Attachment',
        mime_type: a.content_type || existing?.mime_type || 'application/octet-stream',
        size: typeof a.size_bytes === 'number' ? a.size_bytes : (existing?.size || 0),
        entity_type: a.entity_type,
        entity_id: a.entity_id,
        boat_id: boatId,
        storage_type: existing?.storage_type === 'base64' ? 'base64' : 'cloud',
        cloud_attachment_id: a.id || existing?.cloud_attachment_id || null,
        bucket: a.bucket || existing?.bucket || 'boatmatey-attachments',
        path: a.path,
        created_at: existing?.created_at || a.created_at || new Date().toISOString()
      };

      uploadsStorage.save(merged, boatId);
    });
  } catch (e) {
    console.error('refreshBoatUploadsFromCloud error:', e);
  }
}

async function getCloudAttachmentUrl(upload) {
  if (!supabase || !upload?.path) return null;
  const bucket = upload.bucket || 'boatmatey-attachments';
  try {
    const signed = await supabase.storage.from(bucket).createSignedUrl(upload.path, 60 * 10);
    if (!signed?.error && signed?.data?.signedUrl) {
      return signed.data.signedUrl;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(upload.path);
    return data?.publicUrl || null;
  } catch (e) {
    console.error('Error resolving cloud attachment URL:', e);
    return null;
  }
}

async function backfillCloudMetadata(upload) {
  if (!upload?.boat_id || !upload?.entity_type || !upload?.entity_id) return null;
  try {
    const all = await listAttachments(upload.boat_id);
    if (!Array.isArray(all) || !all.length) return null;

    const matches = all.filter((a) => {
      if (a.entity_type !== upload.entity_type) return false;
      if (String(a.entity_id) !== String(upload.entity_id)) return false;
      // Filename/size matching avoids attaching the wrong file when multiple exist.
      const filenameMatch = a.filename && upload.filename && a.filename === upload.filename;
      const sizeMatch = typeof a.size_bytes === 'number' && typeof upload.size === 'number' && a.size_bytes === upload.size;
      return filenameMatch || sizeMatch;
    });

    if (!matches.length) return null;

    const best = matches.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
    if (!best?.path) return null;

    upload.cloud_attachment_id = best.id || upload.cloud_attachment_id || null;
    upload.bucket = best.bucket || upload.bucket || 'boatmatey-attachments';
    upload.path = best.path;
    upload.storage_type = upload.storage_type === 'base64' ? 'base64' : 'cloud';
    uploadsStorage.save(upload, upload.boat_id || null);
    return upload;
  } catch (e) {
    console.error('Error backfilling cloud metadata for upload:', e);
    return null;
  }
}

/**
 * Open/download an upload
 */
export async function openUpload(upload) {
  // Handle link-type uploads
  if (upload.storage_type === 'link' || upload.mime_type === 'text/url' || upload.url) {
    let url = upload.url || upload.filename;
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    window.open(url, '_blank');
    return;
  }

  if (upload.storage_type === 'base64' && upload.data) {
    // Create blob from base64 and open
    const byteCharacters = atob(upload.data.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: upload.mime_type });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Clean up after a delay
    setTimeout(() => URL.revokeObjectURL(url), 100);
    return;
  }

  if (upload.path) {
    const cloudUrl = await getCloudAttachmentUrl(upload);
    if (cloudUrl) {
      window.open(cloudUrl, '_blank');
      return;
    }
  }

  const refreshed = await backfillCloudMetadata(upload);
  if (refreshed?.path) {
    const cloudUrl = await getCloudAttachmentUrl(refreshed);
    if (cloudUrl) {
      window.open(cloudUrl, '_blank');
      return;
    }
  }

  // For files stored as references, we'd need to load from filesystem
  // For now, just show a message
  alert('File is attached, but this device cannot preview it yet. Please re-upload to refresh cloud preview support.');
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
