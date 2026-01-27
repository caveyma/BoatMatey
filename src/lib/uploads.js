/**
 * File upload/attachment handling
 * For now stores metadata + base64 for small images
 * Future: integrate with Capacitor filesystem for native apps
 */

import { uploadsStorage } from './storage.js';
import { uploadAttachment } from './dataService.js';

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
      await uploadAttachment(boatId, file, entityType, entityId);
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

/**
 * Open/download an upload
 */
export function openUpload(upload) {
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
  } else {
    // For files stored as references, we'd need to load from filesystem
    // For now, just show a message
    alert('File stored as reference. Native filesystem support coming soon.');
  }
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
