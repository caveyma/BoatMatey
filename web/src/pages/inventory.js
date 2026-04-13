/**
 * Inventory Page
 * Marine asset inventory: spares, consumables, sails, winches, rigging, and low-stock alerts.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import {
  isBoatArchived,
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem
} from '../lib/dataService.js';
import {
  getUploads,
  saveUpload,
  deleteUpload,
  openUpload,
  formatFileSize,
  getUpload,
  LIMITED_UPLOAD_SIZE_BYTES,
  LIMITED_UPLOADS_PER_ENTITY
} from '../lib/uploads.js';
import { uploadsStorage, inventoryStorage } from '../lib/storage.js';
import { blockFreePlanRecordLimitIfNeeded } from '../lib/premiumSaveGate.js';
import { insertPremiumPreviewBanner } from '../components/premiumPreviewBanner.js';
import { enableRecordCardExpand } from '../utils/recordCardExpand.js';
import {
  MARINE_CATEGORIES,
  LEGACY_INVENTORY_CATEGORIES,
  SAIL_TYPES,
  INVENTORY_CONDITIONS,
  INVENTORY_TEMPLATES,
  INVENTORY_LIST_FILTER,
  emptyDetail,
  mergeDetail,
  getInventoryDetail,
  normalizeInventoryItem,
  categoryUsesStockSection,
  isRiggingCategory,
  inventoryNeedsAttentionStrict,
  inventoryReplacementDueOrSoon,
  inventoryRecommendedReplacementOffsetDays,
  inventorySummaryCounts
} from '../lib/inventoryMarine.js';

const INVENTORY_UNITS = ['pcs', 'litres', 'bottles', 'tubes', 'rolls', 'packs'];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'category', label: 'Category' },
  { value: 'location', label: 'Location' },
  { value: 'stock', label: 'Stock level' },
  { value: 'condition', label: 'Condition' }
];

let currentBoatId = null;
let editingId = null;
let inventoryArchived = false;
let inventoryFileInput = null;
let currentItemIdForUpload = null;

function addSelectOption(select, value, label) {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  select.appendChild(opt);
}

function addOptgroup(select, label) {
  const og = document.createElement('optgroup');
  og.label = label;
  select.appendChild(og);
  return og;
}

function buildInventoryCategoryFilterSelect() {
  const select = document.createElement('select');
  select.id = 'inventory-filter-category';
  select.className = 'form-control';
  select.setAttribute('aria-label', 'Filter inventory');
  addSelectOption(select, '', 'All items');
  const views = addOptgroup(select, 'Views');
  addSelectOption(views, INVENTORY_LIST_FILTER.NEEDS_ATTENTION, 'Needs attention');
  addSelectOption(views, INVENTORY_LIST_FILTER.REPLACEMENT_DUE, 'Replacement due (30 days)');
  addSelectOption(views, INVENTORY_LIST_FILTER.RIGGING_ALL, 'All rigging');
  const marine = addOptgroup(select, 'Categories');
  MARINE_CATEGORIES.forEach(({ value, label }) => addSelectOption(marine, value, label));
  const legacy = addOptgroup(select, 'Earlier categories');
  LEGACY_INVENTORY_CATEGORIES.forEach(({ value, label }) => addSelectOption(legacy, value, label));
  return select;
}

function isLowStock(item) {
  const required = item.required_quantity != null ? Number(item.required_quantity) : 0;
  const stock = item.in_stock_level != null ? Number(item.in_stock_level) : 0;
  return stock <= required;
}

function isCriticalOutOfStock(item) {
  return !!item.critical_spare && (item.in_stock_level == null || Number(item.in_stock_level) === 0);
}

function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  const itemId = params?.itemId || window.routeParams?.itemId;
  const isEditPage = !!itemId;

  if (!currentBoatId) {
    const wrapperError = document.createElement('div');
    wrapperError.innerHTML =
      '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapperError;
  }

  const wrapper = document.createElement('div');
  const header = createYachtHeader(
    isEditPage ? (itemId === 'new' ? 'Add Inventory Item' : 'Edit Inventory Item') : 'Inventory'
  );
  wrapper.appendChild(header);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-inventory';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  if (isEditPage) {
    container.id = 'inventory-list';
    pageContent.appendChild(container);
    wrapper.appendChild(pageContent);
    return wrapper;
  }

  const toolbar = document.createElement('div');
  toolbar.className = 'inventory-toolbar';

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'inventory-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Item`;
  addBtn.onclick = () => navigate(`/boat/${currentBoatId}/inventory/new`);

  const searchWrap = document.createElement('div');
  searchWrap.className = 'inventory-search-wrap';
  searchWrap.innerHTML = `
    <input type="search" id="inventory-search" class="form-control inventory-search" placeholder="Search items..." aria-label="Search inventory">
  `;

  const filtersWrap = document.createElement('div');
  filtersWrap.className = 'inventory-filters';
  filtersWrap.appendChild(buildInventoryCategoryFilterSelect());
  const stockSel = document.createElement('select');
  stockSel.id = 'inventory-filter-stock';
  stockSel.className = 'form-control';
  stockSel.setAttribute('aria-label', 'Filter by stock');
  stockSel.innerHTML =
    '<option value="all">All items</option><option value="low">Low stock only</option>';
  filtersWrap.appendChild(stockSel);
  const sortSel = document.createElement('select');
  sortSel.id = 'inventory-sort';
  sortSel.className = 'form-control';
  sortSel.setAttribute('aria-label', 'Sort by');
  SORT_OPTIONS.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    sortSel.appendChild(opt);
  });
  filtersWrap.appendChild(sortSel);

  toolbar.appendChild(addBtn);
  toolbar.appendChild(searchWrap);
  toolbar.appendChild(filtersWrap);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'inventory-file-input';
  fileInput.multiple = false;
  fileInput.accept = 'image/*,.jpg,.jpeg,.png';
  fileInput.style.display = 'none';

  const summary = document.createElement('div');
  summary.id = 'inventory-summary';
  summary.className = 'inventory-summary text-muted';
  summary.hidden = true;

  const listContainer = document.createElement('div');
  listContainer.id = 'inventory-list';

  container.appendChild(toolbar);
  container.appendChild(summary);
  container.appendChild(fileInput);
  container.appendChild(listContainer);
  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const itemId = params?.itemId || window.routeParams?.itemId;

  if (boatId) currentBoatId = boatId;
  window.navigate = navigate;

  inventoryArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;

  if (itemId) {
    editingId = itemId === 'new' ? `inventory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : itemId;
    await showInventoryForm();
    insertPremiumPreviewBanner(document.querySelector('.page-content.card-color-inventory'), {
      headline: 'Preview: Inventory',
      detail:
        'Basic plan: up to 2 inventory items per boat. Upgrade for unlimited stock tracking.'
    });
    return;
  }

  const addBtn = document.getElementById('inventory-add-btn');
  if (addBtn && inventoryArchived) addBtn.style.display = 'none';

  inventoryFileInput = document.getElementById('inventory-file-input');
  if (inventoryFileInput) {
    inventoryFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file || !currentBoatId || !currentItemIdForUpload) return;
      const existing = getUploads('inventory', currentItemIdForUpload, currentBoatId);
      if (existing.length >= LIMITED_UPLOADS_PER_ENTITY) {
        showToast(`Max ${LIMITED_UPLOADS_PER_ENTITY} photo(s) per item.`, 'error');
        inventoryFileInput.value = '';
        return;
      }
      if (file.size > LIMITED_UPLOAD_SIZE_BYTES) {
        showToast('Photo must be under 2 MB.', 'error');
        inventoryFileInput.value = '';
        return;
      }
      await saveUpload(file, 'inventory', currentItemIdForUpload, currentBoatId);
      inventoryFileInput.value = '';
      if (editingId) {
        const list = document.getElementById('inventory-attachments-list');
        if (list) renderInventoryAttachments(list);
      } else loadInventory();
    });
  }

  const searchEl = document.getElementById('inventory-search');
  const filterCategory = document.getElementById('inventory-filter-category');
  const filterStock = document.getElementById('inventory-filter-stock');
  const sortEl = document.getElementById('inventory-sort');

  const hashForQuery = window.location.hash || '';
  const qIdx = hashForQuery.indexOf('?');
  const queryPart = qIdx >= 0 ? hashForQuery.slice(qIdx + 1) : '';
  const qs = new URLSearchParams(queryPart);
  const stockParam = qs.get('stock');
  if (stockParam === 'low' && filterStock) filterStock.value = 'low';
  const attentionParam = qs.get('attention');
  if (attentionParam === 'needs' && filterCategory) {
    filterCategory.value = INVENTORY_LIST_FILTER.NEEDS_ATTENTION;
  }

  [searchEl, filterCategory, filterStock, sortEl].forEach((el) => {
    if (el) el.addEventListener('change', () => loadInventory());
  });
  if (searchEl) searchEl.addEventListener('input', () => loadInventory());

  insertPremiumPreviewBanner(document.querySelector('.page-content.card-color-inventory'), {
    headline: 'Preview: Inventory',
    detail:
      'Basic plan: up to 2 inventory items per boat. Upgrade for unlimited stock tracking.'
  });

  loadInventory();
}

function applyFiltersAndSort(items, search, categoryFilter, lowStockOnly, sortBy) {
  let list = items.map(normalizeInventoryItem);
  if (search) {
    const q = search.trim().toLowerCase();
    list = list.filter(
      (i) =>
        (i.name && i.name.toLowerCase().includes(q)) ||
        (i.part_number && i.part_number.toLowerCase().includes(q)) ||
        (i.location && i.location.toLowerCase().includes(q)) ||
        (i.category && i.category.toLowerCase().includes(q)) ||
        (getInventoryDetail(i).sailmaker && getInventoryDetail(i).sailmaker.toLowerCase().includes(q)) ||
        (getInventoryDetail(i).rigging_purpose &&
          getInventoryDetail(i).rigging_purpose.toLowerCase().includes(q))
    );
  }
  if (categoryFilter === INVENTORY_LIST_FILTER.NEEDS_ATTENTION) {
    list = list.filter(inventoryNeedsAttentionStrict);
  } else if (categoryFilter === INVENTORY_LIST_FILTER.REPLACEMENT_DUE) {
    list = list.filter(inventoryReplacementDueOrSoon);
  } else if (categoryFilter === INVENTORY_LIST_FILTER.RIGGING_ALL) {
    list = list.filter((i) => isRiggingCategory(i.category));
  } else if (categoryFilter) {
    list = list.filter((i) => i.category === categoryFilter);
  }
  if (lowStockOnly === 'low') list = list.filter(isLowStock);
  const order = sortBy || 'name';
  list.sort((a, b) => {
    if (order === 'name') return (a.name || '').localeCompare(b.name || '');
    if (order === 'category') return (a.category || '').localeCompare(b.category || '');
    if (order === 'location') return (a.location || '').localeCompare(b.location || '');
    if (order === 'stock') {
      const sa = a.in_stock_level != null ? Number(a.in_stock_level) : -1;
      const sb = b.in_stock_level != null ? Number(b.in_stock_level) : -1;
      return sa - sb;
    }
    if (order === 'condition') {
      return (getInventoryDetail(a).condition || '').localeCompare(getInventoryDetail(b).condition || '');
    }
    return 0;
  });
  return list;
}

function formatListSubtitle(item) {
  const row = normalizeInventoryItem(item);
  const d = getInventoryDetail(row);
  const bits = [];
  if (row.category) bits.push(row.category);
  if (row.category === 'Sails' && (d.sail_type || row.type)) bits.push(d.sail_type || row.type);
  else if (row.type) bits.push(row.type);
  return bits.join(' · ');
}

function formatListStatus(item) {
  const row = normalizeInventoryItem(item);
  const useStock = categoryUsesStockSection(row.category);
  if (useStock) {
    const low = isLowStock(row);
    const critical = isCriticalOutOfStock(row);
    const stockClass = critical ? 'inventory-badge-critical' : low ? 'inventory-badge-low' : '';
    const stockLabel = critical ? 'Critical: out of stock' : low ? 'Low stock' : 'OK';
    const unit = row.unit || '';
    const req = row.required_quantity != null ? Number(row.required_quantity) : '';
    const stock = row.in_stock_level != null ? Number(row.in_stock_level) : '—';
    const stockDisplay = unit ? `${stock} ${unit}` : stock;
    return {
      rowClass: `${low ? 'inventory-item-low' : ''} ${critical ? 'inventory-item-critical' : ''}`.trim(),
      badgeClass: stockClass,
      badgeLabel: stockLabel,
      numbers: `Stock: ${stockDisplay}${req !== '' ? ` / Required: ${req}${unit ? ' ' + unit : ''}` : ''}`
    };
  }
  const d = getInventoryDetail(row);
  const cond = (d.condition || '').trim();
  const off = inventoryRecommendedReplacementOffsetDays(row);
  let badgeClass = '';
  let badgeLabel = 'Asset';
  if (inventoryNeedsAttentionStrict(row)) {
    badgeClass = 'inventory-badge-low';
    if (cond === 'Needs Replacement') badgeLabel = 'Needs replacement';
    else if (cond === 'Needs Attention') badgeLabel = 'Needs attention';
    else badgeLabel = 'Replacement overdue';
  } else if (off !== null && off >= 0 && off <= 30) {
    badgeClass = 'inventory-badge-low';
    badgeLabel = off === 0 ? 'Replacement due today' : `Replacement in ${off}d`;
  } else if (cond) {
    badgeLabel = cond;
  }
  const extras = [];
  if (row.category === 'Running Rigging' && d.rigging_purpose) extras.push(d.rigging_purpose);
  if (row.category === 'Standing Rigging' && d.standing_element_type) extras.push(d.standing_element_type);
  const numbers = extras.length ? extras.join(' · ') : cond || 'Quantity not tracked';
  return { rowClass: '', badgeClass, badgeLabel, numbers };
}

async function loadInventory() {
  const listContainer = document.getElementById('inventory-list');
  if (!listContainer) return;

  const items = currentBoatId ? await getInventory(currentBoatId) : [];
  const search = document.getElementById('inventory-search')?.value?.trim() || '';
  const categoryFilter = document.getElementById('inventory-filter-category')?.value || '';
  const lowStockOnly = document.getElementById('inventory-filter-stock')?.value || 'all';
  const sortBy = document.getElementById('inventory-sort')?.value || 'name';

  const summaryEl = document.getElementById('inventory-summary');
  if (summaryEl) {
    const sum = inventorySummaryCounts(items);
    if (items.length === 0) {
      summaryEl.hidden = true;
      summaryEl.textContent = '';
    } else {
      summaryEl.hidden = false;
      const parts = [`${sum.total} item${sum.total === 1 ? '' : 's'}`];
      if (sum.sails) parts.push(`${sum.sails} sail${sum.sails === 1 ? '' : 's'}`);
      if (sum.winches) parts.push(`${sum.winches} winch${sum.winches === 1 ? '' : 'es'}`);
      if (sum.rigging) parts.push(`${sum.rigging} rigging`);
      if (sum.attention) parts.push(`${sum.attention} need attention`);
      summaryEl.textContent = parts.join(' · ');
    }
  }

  const filtered = applyFiltersAndSort(items, search, categoryFilter, lowStockOnly, sortBy);

  if (!filtered.length) {
    const emptyMessage =
      items.length === 0
        ? 'No inventory items yet. Add spares, consumables, sails, winches, rigging, or other gear.'
        : 'No items match your filters.';
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('inventory')}</div>
        <p>${emptyMessage}</p>
        ${items.length === 0 && !inventoryArchived ? `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/inventory/new')">${renderIcon('plus')} Add Item</button></div>` : ''}
      </div>
    `;
    return;
  }

  listContainer.innerHTML = filtered
    .map((item) => {
      const st = formatListStatus(item);
      const locationText = [item.location, item.position].filter(Boolean).join(' • ') || '—';
      const sub = formatListSubtitle(item);

      return `
      <div class="card inventory-item-card ${st.rowClass}" data-item-id="${item.id}">
        <div class="card-header">
          <div class="inventory-item-header-main">
            ${item.photo_url || getUploads('inventory', item.id, currentBoatId).length
              ? `<div class="inventory-item-thumb">${getItemThumb(item)}</div>`
              : ''}
            <div>
              <h3 class="card-title">${escapeHtml(item.name || 'Unnamed')}</h3>
              <p class="text-muted">${escapeHtml(sub)}</p>
              <p class="inventory-item-location">${escapeHtml(locationText)}</p>
              <div class="inventory-item-stock-row">
                <span class="inventory-badge ${st.badgeClass}">${escapeHtml(st.badgeLabel)}</span>
                <span class="inventory-stock-numbers">${escapeHtml(st.numbers)}</span>
              </div>
            </div>
          </div>
          <div class="inventory-item-actions">
            ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="btn-link" title="Open supplier link">${renderIcon('link')} Link</a>` : ''}
            ${!inventoryArchived ? `
            <a href="#/boat/${currentBoatId}/inventory/${item.id}" class="btn-link" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/inventory/${item.id}')">${renderIcon('edit')}</a>
            <button class="btn-link btn-danger" onclick="inventoryPageDelete('${item.id}')">${renderIcon('trash')}</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  enableRecordCardExpand(listContainer);
  attachListHandlers();
}

function getItemThumb(item) {
  const uploads = getUploads('inventory', item.id, currentBoatId);
  const first = uploads[0];
  if (first?.storage_type === 'base64' && first?.data) {
    return `<img src="${first.data}" alt="" class="inventory-thumb-img">`;
  }
  if (item.photo_url) {
    return `<img src="${escapeHtml(item.photo_url)}" alt="" class="inventory-thumb-img">`;
  }
  return `<div class="inventory-thumb-placeholder">${renderIcon('file')}</div>`;
}

function escapeHtml(s) {
  if (s == null) return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function attachListHandlers() {
  window.inventoryPageDelete = async (id) => {
    const ok = await confirmAction({
      title: 'Delete this inventory item?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true
    });
    if (!ok) return;
    await deleteInventoryItem(id);
    loadInventory();
    showToast('Item removed', 'info');
  };
}

function readDetailFromForm(category) {
  const q = (id) => (document.getElementById(id)?.value ?? '').trim();
  const chk = (id) => !!document.getElementById(id)?.checked;
  const d = emptyDetail();
  d.condition = q('inv_d_condition');
  if (category === 'Sails') {
    d.sail_type = q('inv_d_sail_type');
    d.sailmaker = q('inv_d_sailmaker');
    d.sail_material = q('inv_d_sail_material');
    d.stored_location = q('inv_d_stored_location');
    d.purchase_date = q('inv_d_purchase_date');
    d.installed_date = q('inv_d_installed_date');
    d.last_inspected_date = q('inv_d_last_inspected_date');
  }
  if (category === 'Winches') {
    d.winch_size = q('inv_d_winch_size');
    d.self_tailing = chk('inv_d_self_tailing');
    d.electric_winch = chk('inv_d_electric_winch');
    d.installed_date = q('inv_d_installed_date_w');
    d.last_serviced_date = q('inv_d_last_serviced_date');
  }
  if (category === 'Running Rigging') {
    d.rigging_purpose = q('inv_d_rigging_purpose');
    d.rigging_use_location = q('inv_d_rigging_use_location');
    d.line_material = q('inv_d_line_material');
    d.line_diameter = q('inv_d_line_diameter');
    d.line_length = q('inv_d_line_length');
    d.installed_date = q('inv_d_installed_date_r');
    d.last_replaced_date = q('inv_d_last_replaced_date');
  }
  if (category === 'Standing Rigging') {
    d.standing_element_type = q('inv_d_standing_element_type');
    d.standing_location_note = q('inv_d_standing_location_note');
    d.installed_date = q('inv_d_installed_date_s');
    d.last_inspected_date = q('inv_d_last_inspected_date_s');
    d.recommended_replacement_date = q('inv_d_recommended_replacement_date');
  }
  if (category === 'Deck Hardware') {
    d.deck_brand_model = q('inv_d_deck_brand_model');
    d.installed_date = q('inv_d_installed_date_d');
    d.last_inspected_date = q('inv_d_last_inspected_date_d');
  }
  if (categoryUsesStockSection(category)) {
    d.purchase_date = q('inv_d_purchase_date_g');
  }
  return d;
}

function syncInventoryFormPanels() {
  const cat = document.getElementById('inv_category')?.value || '';
  const showStock = categoryUsesStockSection(cat);
  const stockEl = document.getElementById('inv-section-stock');
  if (stockEl) stockEl.style.display = showStock ? '' : 'none';
  const genLife = document.getElementById('inv-section-lifecycle-general');
  if (genLife) genLife.style.display = showStock ? '' : 'none';
  const refSupplier = document.getElementById('inv_supplier_group');
  if (refSupplier) refSupplier.style.display = cat === 'Winches' ? 'none' : '';
  const typeLabel = document.getElementById('inv_type_label');
  if (typeLabel) typeLabel.textContent = cat === 'Winches' ? 'Model' : 'Type / variant';
  const typeInput = document.getElementById('inv_type');
  if (typeInput) {
    typeInput.placeholder =
      cat === 'Winches' ? 'e.g. 40ST' : cat === 'Sails' ? 'Optional — or use sail type below' : 'e.g. Oil, filter';
  }
  const panels = ['Sails', 'Winches', 'Running Rigging', 'Standing Rigging', 'Deck Hardware'];
  panels.forEach((c) => {
    const el = document.getElementById(`inv-panel-${c.replace(/\s+/g, '-').toLowerCase()}`);
    if (el) el.style.display = cat === c ? '' : 'none';
  });
  const tmplWrap = document.getElementById('inv_template_wrap');
  if (tmplWrap) {
    const isNew = tmplWrap.dataset.new === '1';
    const hasTmpl = !!(isNew && INVENTORY_TEMPLATES[cat]?.length);
    tmplWrap.style.display = hasTmpl ? '' : 'none';
  }
}

function repopulateTemplateSelect(category) {
  const sel = document.getElementById('inv_template');
  if (!sel) return;
  const list = INVENTORY_TEMPLATES[category] || [];
  sel.innerHTML = '<option value="">— Optional —</option>';
  list.forEach((t, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = t.label;
    sel.appendChild(opt);
  });
}

async function showInventoryForm() {
  const items = currentBoatId ? await getInventory(currentBoatId) : [];
  const existing = editingId ? items.find((i) => i.id === editingId) : null;
  const isNew = !existing;

  const container = document.getElementById('inventory-list');
  if (!container) return;

  currentItemIdForUpload = existing?.id || editingId;

  const d = getInventoryDetail(existing);
  const sailTypeVal = d.sail_type || existing?.type || '';

  const categoryOptionsHtml = [
    '<option value="">Select...</option>',
    '<optgroup label="Categories">',
    ...MARINE_CATEGORIES.map(
      ({ value, label }) =>
        `<option value="${escapeHtml(value)}" ${existing?.category === value ? 'selected' : ''}>${escapeHtml(
          label
        )}</option>`
    ),
    '</optgroup>',
    '<optgroup label="Earlier categories">',
    ...LEGACY_INVENTORY_CATEGORIES.map(
      ({ value, label }) =>
        `<option value="${escapeHtml(value)}" ${existing?.category === value ? 'selected' : ''}>${escapeHtml(
          label
        )}</option>`
    ),
    '</optgroup>'
  ].join('');

  const conditionOptionsHtml = [
    `<option value="" ${!d.condition ? 'selected' : ''}>—</option>`,
    ...INVENTORY_CONDITIONS.filter((c) => c).map(
      (c) =>
        `<option value="${escapeHtml(c)}" ${d.condition === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
    )
  ].join('');

  const sailTypeOptionsHtml = [
    `<option value="" ${!sailTypeVal ? 'selected' : ''}>—</option>`,
    ...SAIL_TYPES.map(
      (c) =>
        `<option value="${escapeHtml(c)}" ${sailTypeVal === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
    )
  ].join('');

  const formHtml = `
    <div class="card" id="inventory-form-card">
      <h3>${isNew ? 'Add Inventory Item' : 'Edit Inventory Item'}</h3>
      <form id="inventory-form">
        <div class="form-section">
          <h4>Item details</h4>
          <div class="form-group">
            <label for="inv_name">Name *</label>
            <input type="text" id="inv_name" required value="${escapeHtml(existing?.name || '')}" placeholder="e.g. Genoa, Port winch, Impeller kit">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_category">Category</label>
              <select id="inv_category">${categoryOptionsHtml}</select>
            </div>
            <div class="form-group" id="inv_template_wrap" data-new="${isNew ? '1' : '0'}" style="display:none">
              <label for="inv_template">Quick-add template</label>
              <select id="inv_template"><option value="">— Optional —</option></select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_type" id="inv_type_label">Type / variant</label>
              <input type="text" id="inv_type" value="${escapeHtml(existing?.type || '')}" placeholder="e.g. Oil, filter">
            </div>
            <div class="form-group">
              <label for="inv_d_condition">Condition</label>
              <select id="inv_d_condition">${conditionOptionsHtml}</select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_location">Location</label>
              <input type="text" id="inv_location" value="${escapeHtml(existing?.location || '')}" placeholder="e.g. Sail locker, Cockpit">
            </div>
            <div class="form-group">
              <label for="inv_position">Position / note</label>
              <input type="text" id="inv_position" value="${escapeHtml(existing?.position || '')}" placeholder="e.g. Port side">
            </div>
          </div>
        </div>

        <div class="form-section inv-cat-panel" id="inv-panel-sails" style="display:none">
          <h4>Sail details</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_d_sail_type">Sail type</label>
              <select id="inv_d_sail_type">${sailTypeOptionsHtml}</select>
            </div>
            <div class="form-group">
              <label for="inv_d_sailmaker">Sailmaker</label>
              <input type="text" id="inv_d_sailmaker" value="${escapeHtml(d.sailmaker || '')}" placeholder="e.g. North, Doyle">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_d_sail_material">Material</label>
              <input type="text" id="inv_d_sail_material" value="${escapeHtml(d.sail_material || '')}" placeholder="e.g. Dacron, laminate">
            </div>
            <div class="form-group">
              <label for="inv_d_stored_location">Stored location</label>
              <input type="text" id="inv_d_stored_location" value="${escapeHtml(d.stored_location || '')}" placeholder="e.g. Forward locker">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label for="inv_d_purchase_date">Purchase date</label><input type="date" id="inv_d_purchase_date" value="${escapeHtml(d.purchase_date || '')}"></div>
            <div class="form-group"><label for="inv_d_installed_date">Installed / bent on</label><input type="date" id="inv_d_installed_date" value="${escapeHtml(d.installed_date || '')}"></div>
            <div class="form-group"><label for="inv_d_last_inspected_date">Last inspected</label><input type="date" id="inv_d_last_inspected_date" value="${escapeHtml(d.last_inspected_date || '')}"></div>
          </div>
        </div>

        <div class="form-section inv-cat-panel" id="inv-panel-winches" style="display:none">
          <h4>Winch details</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_supplier_brand_w">Brand</label>
              <input type="text" id="inv_supplier_brand_w" value="${escapeHtml(existing?.supplier_brand || '')}" placeholder="e.g. Lewmar, Harken">
            </div>
            <div class="form-group">
              <label for="inv_type_w">Model</label>
              <input type="text" id="inv_type_w" value="${escapeHtml(existing?.type || '')}" placeholder="e.g. 40ST">
            </div>
            <div class="form-group">
              <label for="inv_d_winch_size">Size</label>
              <input type="text" id="inv_d_winch_size" value="${escapeHtml(d.winch_size || '')}" placeholder="e.g. 40">
            </div>
          </div>
          <div class="form-group">
            <label class="checkbox-row"><input type="checkbox" id="inv_d_self_tailing" ${d.self_tailing ? 'checked' : ''}><span>Self-tailing</span></label>
          </div>
          <div class="form-group">
            <label class="checkbox-row"><input type="checkbox" id="inv_d_electric_winch" ${d.electric_winch ? 'checked' : ''}><span>Electric</span></label>
          </div>
          <div class="form-row">
            <div class="form-group"><label for="inv_d_installed_date_w">Installed date</label><input type="date" id="inv_d_installed_date_w" value="${escapeHtml(d.installed_date || '')}"></div>
            <div class="form-group"><label for="inv_d_last_serviced_date">Last serviced</label><input type="date" id="inv_d_last_serviced_date" value="${escapeHtml(d.last_serviced_date || '')}"></div>
          </div>
        </div>

        <div class="form-section inv-cat-panel" id="inv-panel-running-rigging" style="display:none">
          <h4>Running rigging</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_d_rigging_purpose">Purpose</label>
              <input type="text" id="inv_d_rigging_purpose" value="${escapeHtml(d.rigging_purpose || '')}" placeholder="e.g. Halyard, Sheet">
            </div>
            <div class="form-group">
              <label for="inv_d_rigging_use_location">Use / lead</label>
              <input type="text" id="inv_d_rigging_use_location" value="${escapeHtml(d.rigging_use_location || '')}" placeholder="e.g. Masthead to cockpit">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label for="inv_d_line_material">Material</label><input type="text" id="inv_d_line_material" value="${escapeHtml(d.line_material || '')}" placeholder="e.g. Dyneema, polyester"></div>
            <div class="form-group"><label for="inv_d_line_diameter">Diameter</label><input type="text" id="inv_d_line_diameter" value="${escapeHtml(d.line_diameter || '')}" placeholder="e.g. 10 mm"></div>
            <div class="form-group"><label for="inv_d_line_length">Length</label><input type="text" id="inv_d_line_length" value="${escapeHtml(d.line_length || '')}" placeholder="e.g. 35 m"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label for="inv_d_installed_date_r">Installed date</label><input type="date" id="inv_d_installed_date_r" value="${escapeHtml(d.installed_date || '')}"></div>
            <div class="form-group"><label for="inv_d_last_replaced_date">Last replaced</label><input type="date" id="inv_d_last_replaced_date" value="${escapeHtml(d.last_replaced_date || '')}"></div>
          </div>
        </div>

        <div class="form-section inv-cat-panel" id="inv-panel-standing-rigging" style="display:none">
          <h4>Standing rigging</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_d_standing_element_type">Element type</label>
              <input type="text" id="inv_d_standing_element_type" value="${escapeHtml(d.standing_element_type || '')}" placeholder="e.g. Cap shroud, Forestay">
            </div>
            <div class="form-group">
              <label for="inv_d_standing_location_note">Location / side</label>
              <input type="text" id="inv_d_standing_location_note" value="${escapeHtml(d.standing_location_note || '')}" placeholder="e.g. Port, forward">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group"><label for="inv_d_installed_date_s">Installed date</label><input type="date" id="inv_d_installed_date_s" value="${escapeHtml(d.installed_date || '')}"></div>
            <div class="form-group"><label for="inv_d_last_inspected_date_s">Last inspected</label><input type="date" id="inv_d_last_inspected_date_s" value="${escapeHtml(d.last_inspected_date || '')}"></div>
            <div class="form-group"><label for="inv_d_recommended_replacement_date">Recommended replacement</label><input type="date" id="inv_d_recommended_replacement_date" value="${escapeHtml(d.recommended_replacement_date || '')}"></div>
          </div>
        </div>

        <div class="form-section inv-cat-panel" id="inv-panel-deck-hardware" style="display:none">
          <h4>Deck hardware</h4>
          <div class="form-group">
            <label for="inv_d_deck_brand_model">Brand / model</label>
            <input type="text" id="inv_d_deck_brand_model" value="${escapeHtml(d.deck_brand_model || '')}" placeholder="e.g. Spinlock XTS">
          </div>
          <div class="form-row">
            <div class="form-group"><label for="inv_d_installed_date_d">Installed date</label><input type="date" id="inv_d_installed_date_d" value="${escapeHtml(d.installed_date || '')}"></div>
            <div class="form-group"><label for="inv_d_last_inspected_date_d">Last inspected</label><input type="date" id="inv_d_last_inspected_date_d" value="${escapeHtml(d.last_inspected_date || '')}"></div>
          </div>
        </div>

        <div class="form-section" id="inv-section-lifecycle-general">
          <h4>Optional tracking</h4>
          <p class="text-muted" style="margin-top:0">Purchase date and key dates for parts and stores.</p>
          <div class="form-row">
            <div class="form-group"><label for="inv_d_purchase_date_g">Purchase date</label><input type="date" id="inv_d_purchase_date_g" value="${escapeHtml(d.purchase_date || '')}"></div>
          </div>
        </div>

        <div class="form-section" id="inv-section-stock">
          <h4>Stock levels</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_required_quantity">Required quantity</label>
              <input type="number" id="inv_required_quantity" min="0" step="any" value="${existing?.required_quantity != null ? existing.required_quantity : ''}" placeholder="Min to carry">
            </div>
            <div class="form-group">
              <label for="inv_in_stock_level">In stock level</label>
              <input type="number" id="inv_in_stock_level" min="0" step="any" value="${existing?.in_stock_level != null ? existing.in_stock_level : ''}" placeholder="Current">
            </div>
            <div class="form-group">
              <label for="inv_unit">Unit</label>
              <select id="inv_unit">
                <option value="">—</option>
                ${INVENTORY_UNITS.map((u) => `<option value="${u}" ${existing?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="checkbox-row">
              <input type="checkbox" id="inv_critical_spare" ${existing?.critical_spare ? 'checked' : ''}>
              <span>Critical spare (stronger alert when out of stock)</span>
            </label>
          </div>
        </div>

        <div class="form-section">
          <h4>Reference</h4>
          <div class="form-row">
            <div class="form-group">
              <label for="inv_part_number">Part number</label>
              <input type="text" id="inv_part_number" value="${escapeHtml(existing?.part_number || '')}">
            </div>
            <div class="form-group" id="inv_supplier_group">
              <label for="inv_supplier_brand">Supplier / brand</label>
              <input type="text" id="inv_supplier_brand" value="${escapeHtml(existing?.supplier_brand || '')}">
            </div>
          </div>
          <div class="form-group">
            <label for="inv_url">URL</label>
            <input type="url" id="inv_url" value="${escapeHtml(existing?.url || '')}" placeholder="https://...">
          </div>
          <div class="form-group">
            <label for="inv_last_restocked_date">Last restocked date</label>
            <input type="date" id="inv_last_restocked_date" value="${escapeHtml(existing?.last_restocked_date || '')}">
          </div>
        </div>

        <div class="form-section">
          <h4>Photo</h4>
          <div class="inventory-form-photo" id="inventory-form-photo">
            <div class="attachment-list" id="inventory-attachments-list"></div>
            ${!inventoryArchived ? `<button type="button" class="btn-link" id="inventory-add-photo-btn">${renderIcon('plus')} Add photo (max ${LIMITED_UPLOADS_PER_ENTITY})</button>` : ''}
          </div>
        </div>

        <div class="form-section">
          <div class="form-group">
            <label for="inv_notes">Notes</label>
            <textarea id="inv_notes" rows="3">${escapeHtml(existing?.notes || '')}</textarea>
          </div>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" onclick="window.navigate('/boat/${currentBoatId}/inventory')">Cancel</button>
          <button type="submit" class="btn-primary" id="inventory-save-btn">${isNew ? 'Add item' : 'Save changes'}</button>
        </div>
      </form>
    </div>
  `;

  container.innerHTML = formHtml;

  const catEl = document.getElementById('inv_category');
  if (catEl) {
    repopulateTemplateSelect(catEl.value);
    catEl.addEventListener('change', () => {
      repopulateTemplateSelect(catEl.value);
      syncInventoryFormPanels();
    });
  }
  const tmplEl = document.getElementById('inv_template');
  if (tmplEl) {
    tmplEl.addEventListener('change', () => {
      const cat = document.getElementById('inv_category')?.value;
      const list = INVENTORY_TEMPLATES[cat] || [];
      const t = list[Number(tmplEl.value)];
      if (!t) return;
      const nameEl = document.getElementById('inv_name');
      if (nameEl) nameEl.value = t.name || '';
      const typeEl = document.getElementById('inv_type');
      if (typeEl && t.type != null) typeEl.value = t.type;
      if (t.detail && typeof t.detail === 'object') {
        if (t.detail.sail_type) {
          const st = document.getElementById('inv_d_sail_type');
          if (st) st.value = t.detail.sail_type;
        }
        if (t.detail.standing_element_type) {
          const st = document.getElementById('inv_d_standing_element_type');
          if (st) st.value = t.detail.standing_element_type;
        }
        if (t.detail.rigging_purpose) {
          const st = document.getElementById('inv_d_rigging_purpose');
          if (st) st.value = t.detail.rigging_purpose;
        }
      }
    });
  }

  syncInventoryFormPanels();

  const attachmentsList = document.getElementById('inventory-attachments-list');
  const addPhotoBtn = document.getElementById('inventory-add-photo-btn');
  if (attachmentsList) renderInventoryAttachments(attachmentsList);
  if (addPhotoBtn) {
    addPhotoBtn.addEventListener('click', () => {
      if (inventoryFileInput) inventoryFileInput.click();
    });
  }

  document.getElementById('inventory-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('inventory-save-btn');
    if (
      isNew &&
      blockFreePlanRecordLimitIfNeeded('inventory', inventoryStorage.getAll(currentBoatId).length)
    ) {
      return;
    }
    setSaveButtonLoading(btn, true);

    const category = document.getElementById('inv_category').value || null;
    const dFromForm = readDetailFromForm(category);

    if (category === 'Winches') {
      const bw = document.getElementById('inv_supplier_brand_w')?.value?.trim() || '';
      const tw = document.getElementById('inv_type_w')?.value?.trim() || '';
      const refBrand = document.getElementById('inv_supplier_brand');
      const refType = document.getElementById('inv_type');
      if (refBrand) refBrand.value = bw;
      if (refType) refType.value = tw;
    }

    let typeVal = document.getElementById('inv_type')?.value?.trim() || null;
    if (category === 'Sails') {
      const st = document.getElementById('inv_d_sail_type')?.value?.trim() || '';
      if (st) typeVal = st;
    }

    const detailOut = mergeDetail(existing, dFromForm);

    const payload = {
      name: document.getElementById('inv_name').value.trim(),
      category,
      type: typeVal,
      location: document.getElementById('inv_location').value.trim() || null,
      position: document.getElementById('inv_position').value.trim() || null,
      required_quantity: document.getElementById('inv_required_quantity').value.trim() || null,
      in_stock_level: document.getElementById('inv_in_stock_level').value.trim() || null,
      unit: document.getElementById('inv_unit').value || null,
      critical_spare: document.getElementById('inv_critical_spare').checked,
      part_number: document.getElementById('inv_part_number').value.trim() || null,
      supplier_brand: document.getElementById('inv_supplier_brand').value.trim() || null,
      url: document.getElementById('inv_url').value.trim() || null,
      last_restocked_date: document.getElementById('inv_last_restocked_date').value || null,
      notes: document.getElementById('inv_notes').value.trim() || null,
      detail: detailOut
    };

    if (category === 'Winches') {
      payload.supplier_brand = document.getElementById('inv_supplier_brand_w').value.trim() || null;
      payload.type = document.getElementById('inv_type_w').value.trim() || null;
    }

    try {
      if (isNew) {
        const created = await createInventoryItem(currentBoatId, payload);
        if (created?.error) {
          showToast(created.error === 'not_found' ? 'Boat not found' : 'Could not add item', 'error');
        } else {
          const uploads = getUploads('inventory', editingId, currentBoatId);
          uploads.forEach((u) => uploadsStorage.save({ ...u, entity_id: created.id }, currentBoatId));
          showToast('Item added', 'success');
          navigate(`/boat/${currentBoatId}/inventory`);
        }
      } else {
        await updateInventoryItem(editingId, payload);
        showToast('Changes saved', 'success');
        navigate(`/boat/${currentBoatId}/inventory`);
      }
    } catch (err) {
      showToast(err?.message || 'Save failed', 'error');
    } finally {
      setSaveButtonLoading(btn, false);
    }
  });
}

function renderInventoryAttachments(container) {
  if (!container || !currentItemIdForUpload) return;
  const uploads = getUploads('inventory', currentItemIdForUpload, currentBoatId);
  container.innerHTML = '';
  if (uploads.length === 0) {
    container.innerHTML = '<p class="text-muted">No photo.</p>';
    return;
  }
  uploads.forEach((upload) => {
    const item = document.createElement('div');
    item.className = 'attachment-item';
    item.innerHTML = `
      <div class="attachment-info">
        ${upload.storage_type === 'base64' && upload.data ? `<img src="${upload.data}" alt="" class="inventory-form-thumb">` : `<div class="attachment-icon">${renderIcon('file')}</div>`}
        <div class="attachment-details">
          <div class="attachment-name">${escapeHtml(upload.filename)}</div>
          <div class="attachment-meta">${formatFileSize(upload.size)}</div>
        </div>
      </div>
      <div>
        <button type="button" class="btn-link inventory-open-attachment" data-upload-id="${upload.id}">Open</button>
        <button type="button" class="btn-link btn-danger inventory-delete-attachment" data-upload-id="${upload.id}">${renderIcon('trash')}</button>
      </div>
    `;
    container.appendChild(item);
  });

  container.querySelectorAll('.inventory-open-attachment').forEach((btn) => {
    btn.addEventListener('click', () => {
      const upload = getUpload(btn.dataset.uploadId);
      if (upload) openUpload(upload);
    });
  });
  container.querySelectorAll('.inventory-delete-attachment').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmAction({ title: 'Remove this photo?', confirmLabel: 'Remove', cancelLabel: 'Cancel', danger: true });
      if (!ok) return;
      await deleteUpload(btn.dataset.uploadId);
      renderInventoryAttachments(container);
    });
  });
}

export default {
  render,
  onMount
};
