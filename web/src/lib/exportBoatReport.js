/**
 * Complete Boat Export – orchestrator.
 * Premium-only: collects data, builds PDF, then downloads (web) or shares (mobile).
 */

import { Capacitor } from '@capacitor/core';
import { hasActiveSubscription } from './subscription.js';
import { getSession } from './dataService.js';
import { collectBoatExportData } from './boatExport.js';
import { buildPdfReport } from './boatReportPdf.js';

const PREMIUM_REQUIRED_MESSAGE = 'Export Boat Report is a Premium feature.';

/**
 * Sanitise boat name for use in filename (remove path-unsafe chars).
 * @param {string} name
 * @returns {string}
 */
export function sanitiseBoatNameForFilename(name) {
  if (!name || typeof name !== 'string') return 'boat';
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'boat';
}

/**
 * Trigger PDF download in browser.
 * @param {ArrayBuffer} arrayBuffer
 * @param {string} filename
 */
function downloadPdf(arrayBuffer, filename) {
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export boat report: premium check, collect data, build PDF, then download or share.
 * @param {string} boatId
 * @returns {Promise<{ success: boolean, error?: string }>} success false with error 'premium_required' | message
 */
export async function exportBoatReport(boatId) {
  if (!hasActiveSubscription()) {
    return { success: false, error: 'premium_required' };
  }

  if (!boatId) {
    return { success: false, error: 'No boat selected.' };
  }

  try {
    const data = await collectBoatExportData(boatId);
    if (!data.boat) {
      return { success: false, error: 'Boat data could not be loaded.' };
    }

    let accountName = '';
    try {
      const session = await getSession();
      if (session?.user?.email) accountName = session.user.email;
      else if (session?.user?.user_metadata?.full_name) accountName = session.user.user_metadata.full_name;
    } catch (_) {}

    const arrayBuffer = buildPdfReport(data, {
      generatedDate: new Date().toLocaleDateString(undefined, { dateStyle: 'long' }),
      accountName
    });

    const boatName = sanitiseBoatNameForFilename(data.boat.boat_name);
    const filename = `BoatMatey-${boatName}-Report.pdf`;

    const isNative = Capacitor.isNativePlatform?.() ?? false;

    if (isNative) {
      // Mobile: write to cache and share via Capacitor Share
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const path = `BoatMatey/${filename}`;
      await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Cache,
        recursive: true
      });
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
      await Share.share({
        title: 'Boat Report',
        text: `Boat report for ${data.boat.boat_name || 'boat'}`,
        url: uri,
        dialogTitle: 'Share boat report'
      });
      return { success: true };
    }

    // Web: download
    downloadPdf(arrayBuffer, filename);
    return { success: true };
  } catch (err) {
    console.error('[ExportBoatReport]', err);
    const message = err?.message || 'Export failed. Please try again.';
    return { success: false, error: message };
  }
}
