/**
 * Projects & Issues Page
 * Plan and track boat projects/upgrades and logged issues.
 */

import { navigate } from '../router.js';
import { renderIcon } from '../components/icons.js';
import { createYachtHeader, createBackButton } from '../components/header.js';
import { showToast } from '../components/toast.js';
import { confirmAction } from '../components/confirmModal.js';
import { setSaveButtonLoading } from '../utils/saveButton.js';
import { isBoatArchived, getProjects, createProject, updateProject, deleteProject } from '../lib/dataService.js';
import { currencySymbol, CURRENCIES } from '../lib/currency.js';
import {
  getUploads,
  saveUpload,
  deleteUpload,
  openUpload,
  formatFileSize,
  getUpload,
  refreshBoatUploadsFromCloud,
  LIMITED_UPLOAD_SIZE_BYTES,
  LIMITED_UPLOADS_PER_ENTITY
} from '../lib/uploads.js';
import { blockPremiumSaveIfNeeded } from '../lib/premiumSaveGate.js';
import { insertPremiumPreviewBanner } from '../components/premiumPreviewBanner.js';

const CATEGORIES = ['Electronics', 'Mechanical', 'Plumbing', 'Electrical', 'Hull / Deck', 'Interior', 'Safety', 'Other'];
const TYPES = ['Project', 'Issue'];
const PROJECT_STATUSES = ['Planned', 'In Progress', 'Completed'];
const ISSUE_STATUSES = ['Open', 'Under Review', 'In Progress', 'Waiting Parts', 'Resolved', 'Closed'];
const ALL_STATUSES = Array.from(new Set([...PROJECT_STATUSES, ...ISSUE_STATUSES]));
const PRIORITIES = ['Low', 'Medium', 'High'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];

let editingId = null;
let currentBoatId = null;
let projectsArchived = false;
let filterStatus = '';
let filterPriority = '';
let filterCategory = '';
let filterType = '';
let filterArchivedView = 'active'; // active | archived | all
let filterIssueActiveOnly = false;
let viewMode = 'compact'; // compact | expanded
const expandedItemIds = new Set(); // used in compact mode
const collapsedItemIds = new Set(); // used in expanded mode
let sortBy = 'target_date'; // target_date | status | priority | category
let projectFileInput = null;
let currentProjectIdForUpload = null;
let quickIssueModalEl = null;

function escapeHtml(s) {
  if (s == null || s === '') return '';
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function render(params = {}) {
  currentBoatId = params?.id || window.routeParams?.id;
  const projectId = params?.projectId || window.routeParams?.projectId;
  const isEditPage = !!projectId;

  if (!currentBoatId) {
    const wrapperError = document.createElement('div');
    wrapperError.innerHTML =
      '<div class="page-content"><div class="container"><h1>Error</h1><p>Boat ID required</p></div></div>';
    return wrapperError;
  }

  const wrapper = document.createElement('div');
  const yachtHeader = createYachtHeader(
    isEditPage ? (projectId === 'new' ? 'Add Project or Issue' : 'Edit Project or Issue') : 'Projects & Issues'
  );
  wrapper.appendChild(yachtHeader);

  const pageContent = document.createElement('div');
  pageContent.className = 'page-content card-color-projects';
  pageContent.appendChild(createBackButton());

  const container = document.createElement('div');
  container.className = 'container';

  if (isEditPage) {
    container.id = 'projects-list';
    pageContent.appendChild(container);
    wrapper.appendChild(pageContent);
    return wrapper;
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary';
  addBtn.id = 'projects-add-btn';
  addBtn.innerHTML = `${renderIcon('plus')} Add Project or Issue`;
  addBtn.onclick = () => navigate(`/boat/${currentBoatId}/projects/new`);

  const quickAddBtn = document.createElement('button');
  quickAddBtn.className = 'btn-secondary projects-quick-add-btn';
  quickAddBtn.id = 'projects-quick-add-btn';
  quickAddBtn.type = 'button';
  quickAddBtn.innerHTML = `${renderIcon('plus')} Quick Add Issue`;
  quickAddBtn.onclick = () => openQuickAddIssueModal();

  const actionsRow = document.createElement('div');
  actionsRow.className = 'page-actions';
  actionsRow.style.marginBottom = '1rem';
  actionsRow.appendChild(addBtn);
  actionsRow.appendChild(quickAddBtn);

  const quickAddHost = document.createElement('div');
  quickAddHost.id = 'projects-quick-add-host';

  const filtersRow = document.createElement('div');
  filtersRow.className = 'form-row';
  filtersRow.style.marginBottom = '1rem';
  filtersRow.style.gap = '0.75rem';
  filtersRow.style.flexWrap = 'wrap';
  filtersRow.innerHTML = `
    <div class="form-group" style="margin-bottom:0;min-width:120px">
      <label for="filter-status">Status</label>
      <select id="filter-status">
        <option value="">All</option>
        ${ALL_STATUSES.map((s) => `<option value="${s}">${s}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin-bottom:0;min-width:120px">
      <label for="filter-priority">Priority</label>
      <select id="filter-priority">
        <option value="">All</option>
        ${PRIORITIES.map((p) => `<option value="${p}">${p}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin-bottom:0;min-width:140px">
      <label for="filter-category">Category</label>
      <select id="filter-category">
        <option value="">All</option>
        ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin-bottom:0;min-width:140px">
      <label for="filter-type">Type</label>
      <select id="filter-type">
        <option value="">All</option>
        ${TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="margin-bottom:0;min-width:140px">
      <label for="sort-by">Sort by</label>
      <select id="sort-by">
        <option value="target_date">Target date / Date reported</option>
        <option value="status">Status</option>
        <option value="priority">Priority</option>
        <option value="category">Category</option>
      </select>
    </div>
    <div class="form-group" style="margin-bottom:0;min-width:140px">
      <label for="filter-archived">View</label>
      <select id="filter-archived">
        <option value="active">Active</option>
        <option value="archived">Archived</option>
        <option value="all">All</option>
      </select>
    </div>
    <div class="form-group" style="margin-bottom:0;min-width:140px">
      <label for="view-mode">List view</label>
      <select id="view-mode">
        <option value="compact">Compact View</option>
        <option value="expanded">Expanded View</option>
      </select>
    </div>
  `;

  const listContainer = document.createElement('div');
  listContainer.id = 'projects-list';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'projects-file-input';
  fileInput.multiple = true;
  fileInput.accept = '.pdf,.jpg,.jpeg,.png';
  fileInput.style.display = 'none';

  container.appendChild(actionsRow);
  container.appendChild(quickAddHost);
  container.appendChild(filtersRow);
  container.appendChild(fileInput);
  container.appendChild(listContainer);

  pageContent.appendChild(container);
  wrapper.appendChild(pageContent);

  return wrapper;
}

async function onMount(params = {}) {
  const boatId = params?.id || window.routeParams?.id;
  const projectId = params?.projectId || window.routeParams?.projectId;
  if (boatId) currentBoatId = boatId;

  window.navigate = navigate;
  projectsArchived = currentBoatId ? await isBoatArchived(currentBoatId) : false;
  if (currentBoatId) {
    await refreshBoatUploadsFromCloud(currentBoatId);
  }

  if (projectId) {
    editingId = projectId === 'new' ? `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : projectId;
    await showProjectForm();
    insertPremiumPreviewBanner(document.querySelector('.page-content.card-color-projects'), {
      headline: 'Premium preview: Projects & issues',
      detail:
        'Plan jobs, log faults, and keep attachments in one workflow. Upgrade to save projects and issue tracking.'
    });
    return;
  }

  const addBtn = document.getElementById('projects-add-btn');
  const quickAddBtn = document.getElementById('projects-quick-add-btn');
  if (addBtn && projectsArchived) addBtn.style.display = 'none';
  if (quickAddBtn && projectsArchived) quickAddBtn.style.display = 'none';
  if (quickAddBtn) {
    quickAddBtn.type = 'button';
    quickAddBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openQuickAddIssueModal();
    });
  }
  window.projectsPageQuickAddIssue = () => openQuickAddIssueModal();

  projectFileInput = document.getElementById('projects-file-input');
  if (projectFileInput) {
    projectFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId || !currentProjectIdForUpload) return;
      const existing = getUploads('project', currentProjectIdForUpload, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;
      if (remainingSlots <= 0) {
        showToast(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this item.`, 'error');
        projectFileInput.value = '';
        return;
      }
      let oversizedCount = 0;
      const validFiles = [];
      files.forEach((file) => {
        if (file.size > LIMITED_UPLOAD_SIZE_BYTES) oversizedCount++;
        else validFiles.push(file);
      });
      if (oversizedCount > 0) showToast('Some files were larger than 2 MB and were skipped.', 'info');
      if (!validFiles.length) {
        projectFileInput.value = '';
        return;
      }
      const toUpload = validFiles.slice(0, remainingSlots);
      for (const file of toUpload) await saveUpload(file, 'project', currentProjectIdForUpload, currentBoatId);
      projectFileInput.value = '';
      loadProjects();
    });
  }

  const filterStatusEl = document.getElementById('filter-status');
  const filterPriorityEl = document.getElementById('filter-priority');
  const filterCategoryEl = document.getElementById('filter-category');
  const filterTypeEl = document.getElementById('filter-type');
  const filterArchivedEl = document.getElementById('filter-archived');
  const viewModeEl = document.getElementById('view-mode');
  const sortByEl = document.getElementById('sort-by');
  const hash = window.location.hash || '';
  const queryString = hash.includes('?') ? hash.split('?')[1] : '';
  const query = new URLSearchParams(queryString);
  if (query.get('type') === 'Issue') filterType = 'Issue';
  if (query.get('status') === 'active') filterIssueActiveOnly = true;
  if (query.get('archived') === 'active') filterArchivedView = 'active';
  if (filterStatusEl) filterStatusEl.addEventListener('change', () => { filterStatus = filterStatusEl.value; loadProjects(); });
  if (filterPriorityEl) filterPriorityEl.addEventListener('change', () => { filterPriority = filterPriorityEl.value; loadProjects(); });
  if (filterCategoryEl) filterCategoryEl.addEventListener('change', () => { filterCategory = filterCategoryEl.value; loadProjects(); });
  if (filterTypeEl) filterTypeEl.addEventListener('change', () => { filterType = filterTypeEl.value; filterIssueActiveOnly = false; loadProjects(); });
  if (filterArchivedEl) filterArchivedEl.addEventListener('change', () => { filterArchivedView = filterArchivedEl.value || 'active'; loadProjects(); });
  if (viewModeEl) viewModeEl.addEventListener('change', () => { viewMode = viewModeEl.value || 'compact'; loadProjects(); });
  if (sortByEl) sortByEl.addEventListener('change', () => { sortBy = sortByEl.value; loadProjects(); });

  insertPremiumPreviewBanner(document.querySelector('.page-content.card-color-projects'), {
    headline: 'Premium preview: Projects & issues',
    detail:
      'Plan jobs, log faults, and keep attachments in one workflow. Upgrade to save projects and issue tracking.'
  });

  loadProjects();
}

function statusBadgeClass(status) {
  if (!status) return 'project-badge project-badge-other';
  const s = status.toLowerCase().replace(/\s+/g, '-');
  if (s === 'completed') return 'project-badge project-badge-completed';
  if (s === 'cancelled') return 'project-badge project-badge-cancelled';
  if (s === 'in-progress') return 'project-badge project-badge-in-progress';
  if (['idea', 'planning', 'parts-ordered', 'scheduled'].includes(s)) return 'project-badge project-badge-planned';
  return 'project-badge project-badge-other';
}

function typeBadgeClass(type) {
  return type === 'Issue' ? 'project-badge project-badge-cancelled' : 'project-badge project-badge-planned';
}

function priorityClass(priority) {
  if (priority === 'High') return 'priority-high';
  if (priority === 'Medium') return 'priority-medium';
  return 'priority-low';
}

function isItemExpanded(id) {
  if (viewMode === 'expanded') return !collapsedItemIds.has(id);
  return expandedItemIds.has(id);
}

async function loadProjects() {
  const listContainer = document.getElementById('projects-list');
  let projects = currentBoatId ? await getProjects(currentBoatId) : [];
  projects = projects.map((p) => ({ ...p, type: p.type || 'Project' }));

  if (filterArchivedView === 'active') {
    projects = projects.filter((p) => !p.archived_at);
  } else if (filterArchivedView === 'archived') {
    projects = projects.filter((p) => !!p.archived_at);
  }

  if (filterStatus) projects = projects.filter((p) => p.status === filterStatus);
  if (filterPriority) projects = projects.filter((p) => p.priority === filterPriority);
  if (filterCategory) projects = projects.filter((p) => p.category === filterCategory);
  if (filterType) projects = projects.filter((p) => (p.type || 'Project') === filterType);
  if (filterIssueActiveOnly) {
    const activeIssueStatuses = new Set(['Open', 'Under Review', 'In Progress', 'Waiting Parts']);
    projects = projects.filter((p) => (p.type || 'Project') === 'Issue' && activeIssueStatuses.has(p.status || '') && !p.archived_at);
  }

  if (filterArchivedView === 'archived') {
    projects = [...projects].sort((a, b) => {
      const da = a.archived_at ? new Date(a.archived_at).getTime() : 0;
      const db = b.archived_at ? new Date(b.archived_at).getTime() : 0;
      if (da !== db) return db - da;
      return (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || '');
    });
  } else if (sortBy === 'target_date') {
    const projectsOnly = projects.filter((p) => (p.type || 'Project') !== 'Issue');
    const issuesOnly = projects.filter((p) => (p.type || 'Project') === 'Issue');
    const sortedProjects = [...projectsOnly].sort((a, b) => {
      const da = a.target_date ? new Date(a.target_date).getTime() : 0;
      const db = b.target_date ? new Date(b.target_date).getTime() : 0;
      if (da !== db) return da - db;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    const sortedIssues = [...issuesOnly].sort((a, b) => {
      const da = a.date_reported ? new Date(a.date_reported).getTime() : 0;
      const db = b.date_reported ? new Date(b.date_reported).getTime() : 0;
      if (da !== db) return db - da;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
    projects = [...sortedIssues, ...sortedProjects];
  } else if (sortBy === 'status') {
    const order = { Planned: 0, Open: 1, 'Under Review': 2, 'In Progress': 3, 'Waiting Parts': 4, Resolved: 5, Completed: 6, Closed: 7 };
    projects = [...projects].sort((a, b) => (order[a.status] ?? 8) - (order[b.status] ?? 8));
  } else if (sortBy === 'priority') {
    const order = { High: 0, Medium: 1, Low: 2 };
    projects = [...projects].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
  } else if (sortBy === 'category') {
    projects = [...projects].sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  }

  const filterStatusEl = document.getElementById('filter-status');
  const filterPriorityEl = document.getElementById('filter-priority');
  const filterCategoryEl = document.getElementById('filter-category');
  const filterTypeEl = document.getElementById('filter-type');
  const filterArchivedEl = document.getElementById('filter-archived');
  const viewModeEl = document.getElementById('view-mode');
  const sortByEl = document.getElementById('sort-by');
  if (filterStatusEl) filterStatusEl.value = filterStatus;
  if (filterPriorityEl) filterPriorityEl.value = filterPriority;
  if (filterCategoryEl) filterCategoryEl.value = filterCategory;
  if (filterTypeEl) filterTypeEl.value = filterType;
  if (filterArchivedEl) filterArchivedEl.value = filterArchivedView;
  if (viewModeEl) viewModeEl.value = viewMode;
  if (sortByEl) sortByEl.value = sortBy;

  if (!projects || projects.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('clipboard')}</div>
        <p>${filterArchivedView === 'archived' ? 'No archived Projects or Issues' : 'No Projects or Issues yet'}</p>
        ${!projectsArchived ? `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/projects/new')">${renderIcon('plus')} Add Project or Issue</button></div>` : ''}
      </div>
    `;
    return;
  }

  listContainer.innerHTML = projects
    .map((p) => {
      const targetStr = p.target_date ? new Date(p.target_date).toLocaleDateString() : '';
      const completedStr = p.completed_date ? new Date(p.completed_date).toLocaleDateString() : '';
      const dateReportedStr = p.date_reported ? new Date(p.date_reported).toLocaleDateString() : '';
      const archivedStr = p.archived_at ? new Date(p.archived_at).toLocaleDateString() : '';
      const estCost = p.estimated_cost != null ? `${currencySymbol(p.estimated_cost_currency)}${Number(p.estimated_cost).toFixed(2)}` : '';
      const actCost = p.actual_cost != null ? `${currencySymbol(p.actual_cost_currency)}${Number(p.actual_cost).toFixed(2)}` : '';
      const prioritySpan = p.priority ? `<span class="project-priority ${priorityClass(p.priority)}">${escapeHtml(p.priority)}</span>` : '';
      const itemType = p.type || 'Project';
      const expanded = isItemExpanded(p.id);
      const compactSecondaryLine = itemType === 'Issue'
        ? (dateReportedStr ? `Reported ${dateReportedStr}` : 'No report date')
        : (targetStr ? `Target ${targetStr}` : 'No target date');
      const compactPriorityOrSeverity = itemType === 'Issue'
        ? (p.severity ? `Severity: ${escapeHtml(p.severity)}` : 'Severity: —')
        : (p.priority ? `Priority: ${escapeHtml(p.priority)}` : 'Priority: —');
      return `
      <div class="card">
        <div class="card-header">
          <div style="display:flex;align-items:flex-start;gap:0.5rem;flex:1;min-width:0">
            <button
              type="button"
              class="projects-expand-toggle"
              aria-expanded="${expanded ? 'true' : 'false'}"
              aria-label="${expanded ? 'Collapse details' : 'Expand details'}"
              title="${expanded ? 'Click to collapse' : 'Click to expand'}"
              onclick="projectsPageToggleExpand('${p.id}')"
            >
              <span class="projects-expand-chevron ${expanded ? 'is-expanded' : ''}" aria-hidden="true">▶</span>
              <span style="min-width:0">
                <span class="card-title" style="display:block">${escapeHtml(p.project_name)}</span>
              </span>
            </button>
            <div style="min-width:0;flex:1">
            <p class="text-muted">${escapeHtml(p.category || '')} ${prioritySpan ? ' · ' : ''} ${prioritySpan}</p>
              <p class="text-muted" style="margin:0.2rem 0 0 0;font-size:0.85rem">${compactPriorityOrSeverity} · ${compactSecondaryLine}</p>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <span class="${typeBadgeClass(itemType)}">${escapeHtml(itemType)}</span>
            <span class="${statusBadgeClass(p.status)}">${escapeHtml(p.status || '—')}</span>
            ${p.archived_at ? `<span class="project-badge project-badge-other">Archived</span>` : ''}
            ${!projectsArchived ? `
            <button class="btn-link" onclick="projectsPageToggleArchive('${p.id}', ${p.archived_at ? 'false' : 'true'})">${p.archived_at ? 'Unarchive' : 'Archive'}</button>
            <a href="#/boat/${currentBoatId}/projects/${p.id}" class="btn-link" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/projects/${p.id}')">${renderIcon('edit')}</a>
            <button class="btn-link btn-danger" onclick="projectsPageDelete('${p.id}')">${renderIcon('trash')}</button>
            ` : ''}
          </div>
        </div>
        <div style="display:${expanded ? 'block' : 'none'}">
          ${p.description ? `<p>${escapeHtml(p.description).replace(/\n/g, '<br>')}</p>` : ''}
          ${itemType === 'Project' && targetStr ? `<p><strong>Target:</strong> ${targetStr}</p>` : ''}
          ${itemType === 'Issue' && p.reported_by ? `<p><strong>Reported by:</strong> ${escapeHtml(p.reported_by)}</p>` : ''}
          ${itemType === 'Issue' && dateReportedStr ? `<p><strong>Date reported:</strong> ${dateReportedStr}</p>` : ''}
          ${itemType === 'Issue' && p.severity ? `<p><strong>Severity:</strong> ${escapeHtml(p.severity)}</p>` : ''}
          ${p.archived_at && archivedStr ? `<p><strong>Archived:</strong> ${archivedStr}</p>` : ''}
          ${p.status === 'Completed' && completedStr ? `<p><strong>Completed:</strong> ${completedStr}</p>` : ''}
          ${estCost ? `<p><strong>Est. cost:</strong> ${estCost}</p>` : ''}
          ${actCost ? `<p><strong>Actual cost:</strong> ${actCost}</p>` : ''}
          ${p.supplier_installer ? `<p><strong>Supplier/Installer:</strong> ${escapeHtml(p.supplier_installer)}</p>` : ''}
          ${p.notes ? `<p><strong>Notes:</strong> ${escapeHtml(p.notes).replace(/\n/g, '<br>')}</p>` : ''}
          <div class="project-attachments" data-project-id="${p.id}">
            <h4 style="margin-top:0.75rem;margin-bottom:0.25rem">Photos & Documents</h4>
            <div class="attachment-list" id="projects-attachments-list-${p.id}"></div>
            <button type="button" class="btn-link" onclick="projectsPageAddAttachment('${p.id}')">${renderIcon('plus')} Add Attachment (max ${LIMITED_UPLOADS_PER_ENTITY}, 2 MB each)</button>
          </div>
        </div>
      </div>
    `;
    })
    .join('');

  attachListHandlers();
  loadProjectAttachments(projects);
}

function attachListHandlers() {
  window.projectsPageDelete = async (id) => {
    const ok = await confirmAction({ title: 'Delete this item?', message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
    if (!ok) return;
    await deleteProject(id);
    loadProjects();
    showToast('Item removed', 'info');
  };
  window.projectsPageAddAttachment = (projectId) => {
    currentProjectIdForUpload = projectId;
    if (projectFileInput) projectFileInput.click();
  };
  window.projectsPageToggleExpand = (id) => {
    if (viewMode === 'expanded') {
      if (collapsedItemIds.has(id)) collapsedItemIds.delete(id);
      else collapsedItemIds.add(id);
    } else {
      if (expandedItemIds.has(id)) expandedItemIds.delete(id);
      else expandedItemIds.add(id);
    }
    loadProjects();
  };
  window.projectsPageToggleArchive = async (id, shouldArchive) => {
    const ok = await confirmAction({
      title: shouldArchive ? 'Archive this item?' : 'Unarchive this item?',
      message: shouldArchive ? 'You can unarchive it later.' : 'This item will return to active work.',
      confirmLabel: shouldArchive ? 'Archive' : 'Unarchive',
      cancelLabel: 'Cancel'
    });
    if (!ok) return;
    await updateProject(id, { archived_at: shouldArchive ? new Date().toISOString() : null });
    loadProjects();
    showToast(shouldArchive ? 'Item archived' : 'Item unarchived', 'success');
  };
}

function closeQuickAddIssueModal() {
  if (quickIssueModalEl) {
    quickIssueModalEl.remove();
    quickIssueModalEl = null;
  }
}

function openQuickAddIssueModal() {
  try {
    if (projectsArchived) return;
    closeQuickAddIssueModal();
    const host = document.getElementById('projects-quick-add-host');
    if (!host) {
      showToast('Could not open quick issue form', 'error');
      return;
    }
    quickIssueModalEl = document.createElement('div');
    quickIssueModalEl.className = 'card';
    quickIssueModalEl.style.maxWidth = '640px';
    quickIssueModalEl.style.marginBottom = '1rem';
    quickIssueModalEl.innerHTML = `
      <h3 style="margin-bottom:0.75rem">Log Issue</h3>
      <form id="quick-issue-form">
        <div class="form-group">
          <label for="quick_issue_title">Title *</label>
          <input id="quick_issue_title" type="text" required placeholder="e.g. Bilge pump not working">
        </div>
        <div class="form-group">
          <label for="quick_issue_category">Category</label>
          <select id="quick_issue_category">
            <option value="">Select...</option>
            ${CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="quick_issue_severity">Severity *</label>
          <select id="quick_issue_severity" required>
            <option value="">Select...</option>
            ${SEVERITIES.map((s) => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="quick_issue_reported_by">Reported By</label>
          <input id="quick_issue_reported_by" type="text" placeholder="Name">
        </div>
        <div class="form-group">
          <label for="quick_issue_notes">Notes / Description</label>
          <textarea id="quick_issue_notes" rows="3" placeholder="Optional notes"></textarea>
        </div>
        <div class="form-actions" style="margin-top:0.75rem">
          <button type="button" class="btn-secondary" id="quick-issue-cancel-btn">Cancel</button>
          <button type="submit" class="btn-primary" id="quick-issue-save-btn">Save Issue</button>
        </div>
      </form>
  `;
    host.appendChild(quickIssueModalEl);

    const cancelBtn = document.getElementById('quick-issue-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeQuickAddIssueModal);

    const form = document.getElementById('quick-issue-form');
    const saveBtn = document.getElementById('quick-issue-save-btn');
    if (form) {
      form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('quick_issue_title')?.value?.trim() || '';
      const category = document.getElementById('quick_issue_category')?.value || null;
      const severity = document.getElementById('quick_issue_severity')?.value || '';
      const reportedBy = document.getElementById('quick_issue_reported_by')?.value?.trim() || null;
      const notes = document.getElementById('quick_issue_notes')?.value?.trim() || null;
      if (!title) {
        showToast('Title is required', 'error');
        return;
      }
      if (!severity) {
        showToast('Severity is required', 'error');
        return;
      }
      if (blockPremiumSaveIfNeeded()) return;
      setSaveButtonLoading(saveBtn, true);
      try {
        const payload = {
          id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          project_name: title,
          category,
          description: notes,
          type: 'Issue',
          status: 'Open',
          severity,
          reported_by: reportedBy,
          date_reported: new Date().toISOString().slice(0, 10),
          archived_at: null
        };
        const created = await createProject(currentBoatId, payload);
        closeQuickAddIssueModal();
        await loadProjects();
        const createdId = created?.id || payload.id;
        showToast('Issue logged. Edit details if needed.', 'success');
        if (createdId && !expandedItemIds.has(createdId) && !collapsedItemIds.has(createdId)) {
          // Keep compact by default; do not auto-expand.
        }
      } catch (err) {
        showToast(err?.message || 'Failed to save issue', 'error');
      } finally {
        setSaveButtonLoading(saveBtn, false);
      }
    });
    } else {
      showToast('Could not open quick issue form', 'error');
    }
  } catch (err) {
    showToast(err?.message || 'Could not open quick issue form', 'error');
  }
}

function loadProjectAttachments(projects) {
  if (!currentBoatId) return;
  projects.forEach((p) => {
    const listEl = document.getElementById(`projects-attachments-list-${p.id}`);
    if (!listEl) return;
    const attachments = getUploads('project', p.id, currentBoatId);
    listEl.innerHTML = '';
    if (attachments.length === 0) {
      listEl.innerHTML = '<p class="text-muted">No attachments.</p>';
      return;
    }
    attachments.forEach((upload) => {
      const item = document.createElement('div');
      item.className = 'attachment-item';
      item.innerHTML = `
        <div class="attachment-info">
          <div class="attachment-icon">${renderIcon('file')}</div>
          <div class="attachment-details">
            <div class="attachment-name">${escapeHtml(upload.filename)}</div>
            <div class="attachment-meta">${formatFileSize(upload.size)} • ${upload.mime_type || ''}</div>
          </div>
        </div>
        <div>
          <button type="button" class="btn-link project-open-attachment-btn" data-upload-id="${upload.id}">Open</button>
          <button type="button" class="btn-link btn-danger project-delete-attachment-btn" data-upload-id="${upload.id}">${renderIcon('trash')}</button>
        </div>
      `;
      listEl.appendChild(item);
    });
  });
  document.querySelectorAll('.project-open-attachment-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const upload = getUpload(btn.dataset.uploadId);
      if (upload) openUpload(upload);
    });
  });
  document.querySelectorAll('.project-delete-attachment-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmAction({ title: 'Delete this attachment?', message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
      if (!ok) return;
      await deleteUpload(btn.dataset.uploadId);
      loadProjects();
      showToast('Attachment removed', 'info');
    });
  });
}

async function showProjectForm() {
  const projects = currentBoatId ? await getProjects(currentBoatId) : [];
  const existing = editingId ? projects.find((p) => p.id === editingId) : null;
  if (!editingId) editingId = `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const entry = existing;

  const formHtml = `
    <div class="card" id="project-form-card">
      <h3>${existing ? 'Edit Project or Issue' : 'Add Project or Issue'}</h3>
      <form id="project-form">
        <div class="form-group">
          <label for="project_type">Type *</label>
          <select id="project_type" required>
            ${TYPES.map((t) => `<option value="${t}" ${(entry?.type || 'Project') === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="project_name">Title *</label>
          <input type="text" id="project_name" required value="${escapeHtml(entry?.project_name || '')}" placeholder="e.g. Install Stern Thruster">
        </div>
        <div class="form-group">
          <label for="project_category">Category</label>
          <select id="project_category">
            <option value="">Select...</option>
            ${CATEGORIES.map((c) => `<option value="${c}" ${entry?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="project_description">Description</label>
          <textarea id="project_description" rows="3" placeholder="Describe the project">${escapeHtml(entry?.description || '')}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="project_status">Status</label>
            <select id="project_status">
              <option value="">Select...</option>
            </select>
          </div>
          <div class="form-group">
            <label for="project_priority">Priority</label>
            <select id="project_priority">
              <option value="">Select...</option>
              ${PRIORITIES.map((p) => `<option value="${p}" ${entry?.priority === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row" id="issue-fields-row-1" style="display:none">
          <div class="form-group">
            <label for="project_reported_by">Reported By</label>
            <input type="text" id="project_reported_by" value="${escapeHtml(entry?.reported_by || '')}" placeholder="Name">
          </div>
          <div class="form-group">
            <label for="project_date_reported">Date Reported</label>
            <input type="date" id="project_date_reported" value="${entry?.date_reported || ''}">
          </div>
        </div>
        <div class="form-row" id="issue-fields-row-2" style="display:none">
          <div class="form-group">
            <label for="project_severity">Severity</label>
            <select id="project_severity">
              <option value="">Select...</option>
              ${SEVERITIES.map((s) => `<option value="${s}" ${entry?.severity === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row" id="target-date-row">
          <div class="form-group">
            <label for="project_target_date">Target date</label>
            <input type="date" id="project_target_date" value="${entry?.target_date || ''}">
          </div>
          <div class="form-group">
            <label for="project_completed_date">Completed date</label>
            <input type="date" id="project_completed_date" value="${entry?.completed_date || ''}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="project_estimated_cost">Estimated cost</label>
            <input type="number" id="project_estimated_cost" step="0.01" min="0" value="${entry?.estimated_cost != null ? entry.estimated_cost : ''}">
          </div>
          <div class="form-group">
            <label for="project_estimated_cost_currency">Currency</label>
            <select id="project_estimated_cost_currency">
              ${CURRENCIES.map((c) => `<option value="${c.code}" ${(entry?.estimated_cost_currency || 'GBP') === c.code ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="project_actual_cost">Actual cost</label>
            <input type="number" id="project_actual_cost" step="0.01" min="0" value="${entry?.actual_cost != null ? entry.actual_cost : ''}">
          </div>
          <div class="form-group">
            <label for="project_actual_cost_currency">Currency</label>
            <select id="project_actual_cost_currency">
              ${CURRENCIES.map((c) => `<option value="${c.code}" ${(entry?.actual_cost_currency || 'GBP') === c.code ? 'selected' : ''}>${c.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="project_supplier_installer">Supplier / Installer</label>
          <input type="text" id="project_supplier_installer" value="${escapeHtml(entry?.supplier_installer || '')}" placeholder="e.g. South Coast Marine">
        </div>
        <div class="form-group">
          <label for="project_notes">Notes</label>
          <textarea id="project_notes" rows="3" placeholder="Additional comments, haulout reminders, dependencies">${escapeHtml(entry?.notes || '')}</textarea>
        </div>
        <div class="project-form-attachments card" style="margin-top:1rem">
          <h4>Attachments</h4>
          <div class="attachment-list" id="project-form-attachments-list"></div>
          <button type="button" class="btn-link" id="project-form-add-attachment">${renderIcon('plus')} Add file (max ${LIMITED_UPLOADS_PER_ENTITY}, 2 MB each)</button>
        </div>
        <div class="form-actions" style="margin-top:1rem">
          <button type="button" class="btn-secondary" id="project-form-cancel">Cancel</button>
          <button type="submit" class="btn-primary" id="project-form-save">${existing ? 'Save changes' : 'Add project or issue'}</button>
        </div>
      </form>
    </div>
  `;

  const listContainer = document.getElementById('projects-list');
  listContainer.innerHTML = formHtml;

  const form = document.getElementById('project-form');
  const cancelBtn = document.getElementById('project-form-cancel');
  const saveBtn = document.getElementById('project-form-save');
  const addAttachmentBtn = document.getElementById('project-form-add-attachment');
  const typeEl = document.getElementById('project_type');
  const statusEl = document.getElementById('project_status');
  const issueRow1 = document.getElementById('issue-fields-row-1');
  const issueRow2 = document.getElementById('issue-fields-row-2');
  const targetDateRow = document.getElementById('target-date-row');
  const reportedByEl = document.getElementById('project_reported_by');
  const dateReportedEl = document.getElementById('project_date_reported');
  const severityEl = document.getElementById('project_severity');

  function fillStatusOptions(selected) {
    const selectedType = typeEl?.value || 'Project';
    const options = selectedType === 'Issue' ? ISSUE_STATUSES : PROJECT_STATUSES;
    statusEl.innerHTML = `<option value="">Select...</option>${options
      .map((s) => `<option value="${s}" ${selected === s ? 'selected' : ''}>${s}</option>`)
      .join('')}`;
  }

  function syncTypeVisibility() {
    const selectedType = typeEl?.value || 'Project';
    const isIssue = selectedType === 'Issue';
    if (issueRow1) issueRow1.style.display = isIssue ? '' : 'none';
    if (issueRow2) issueRow2.style.display = isIssue ? '' : 'none';
    if (targetDateRow) targetDateRow.style.opacity = isIssue ? '0.6' : '1';
    if (reportedByEl) reportedByEl.required = isIssue;
    if (dateReportedEl) {
      dateReportedEl.required = isIssue;
      if (isIssue && !dateReportedEl.value) {
        dateReportedEl.value = new Date().toISOString().slice(0, 10);
      }
    }
    if (severityEl) severityEl.required = isIssue;
    if (statusEl) {
      const currentValue = statusEl.value;
      fillStatusOptions(currentValue);
      if (!statusEl.value) statusEl.value = isIssue ? 'Open' : 'Planned';
    }
  }

  if (projectsArchived) {
    form.querySelectorAll('input, select, textarea').forEach((el) => { el.disabled = true; });
    saveBtn.style.display = 'none';
    addAttachmentBtn.style.display = 'none';
  }

  cancelBtn.addEventListener('click', () => navigate(`/boat/${currentBoatId}/projects`));
  if (typeEl) {
    fillStatusOptions(entry?.status || null);
    syncTypeVisibility();
    typeEl.addEventListener('change', syncTypeVisibility);
  }

  function getFormPayload() {
    const estCost = document.getElementById('project_estimated_cost').value;
    const actCost = document.getElementById('project_actual_cost').value;
    const payload = {
      id: editingId,
      type: document.getElementById('project_type').value || 'Project',
      project_name: document.getElementById('project_name').value.trim(),
      category: document.getElementById('project_category').value || null,
      description: document.getElementById('project_description').value.trim() || null,
      status: document.getElementById('project_status').value || null,
      priority: document.getElementById('project_priority').value || null,
      target_date: document.getElementById('project_target_date').value || null,
      completed_date: document.getElementById('project_completed_date').value || null,
      reported_by: document.getElementById('project_reported_by').value.trim() || null,
      date_reported: document.getElementById('project_date_reported').value || null,
      severity: document.getElementById('project_severity').value || null,
      estimated_cost: estCost === '' ? null : parseFloat(estCost),
      estimated_cost_currency: document.getElementById('project_estimated_cost_currency').value || 'GBP',
      actual_cost: actCost === '' ? null : parseFloat(actCost),
      actual_cost_currency: document.getElementById('project_actual_cost_currency').value || 'GBP',
      supplier_installer: document.getElementById('project_supplier_installer').value.trim() || null,
      notes: document.getElementById('project_notes').value.trim() || null,
      archived_at: entry?.archived_at || null
    };
    const shouldAutoArchive =
      (payload.type === 'Issue' && payload.status === 'Closed')
      || (payload.type === 'Project' && payload.status === 'Completed');
    payload.archived_at = shouldAutoArchive ? (payload.archived_at || new Date().toISOString()) : null;
    return payload;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (projectsArchived) return;
    const payload = getFormPayload();
    if (!payload.project_name) {
      showToast('Title is required', 'error');
      return;
    }
    if (payload.type === 'Issue' && (!payload.reported_by || !payload.date_reported || !payload.severity)) {
      showToast('Reported By, Date Reported and Severity are required for issues', 'error');
      return;
    }
    const isNew = !existing || existing.id !== editingId;
    if (isNew && blockPremiumSaveIfNeeded()) return;
    setSaveButtonLoading(saveBtn, true);
    try {
      if (isNew) {
        await createProject(currentBoatId, payload);
        showToast(`${payload.type === 'Issue' ? 'Issue' : 'Project'} added`, 'success');
      } else {
        await updateProject(editingId, payload);
        showToast(`${payload.type === 'Issue' ? 'Issue' : 'Project'} updated`, 'success');
      }
      navigate(`/boat/${currentBoatId}/projects`);
    } catch (err) {
      showToast(err?.message || 'Failed to save', 'error');
    } finally {
      setSaveButtonLoading(saveBtn, false);
    }
  });

  const formFileInput = document.createElement('input');
  formFileInput.type = 'file';
  formFileInput.multiple = true;
  formFileInput.accept = '.pdf,.jpg,.jpeg,.png';
  formFileInput.style.display = 'none';
  formFileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !currentBoatId) return;
    const existingUploads = getUploads('project', editingId, currentBoatId);
    const remaining = LIMITED_UPLOADS_PER_ENTITY - existingUploads.length;
    if (remaining <= 0) {
      showToast(`Max ${LIMITED_UPLOADS_PER_ENTITY} files per item.`, 'error');
      formFileInput.value = '';
      return;
    }
    for (const file of files.slice(0, remaining)) {
      if (file.size > LIMITED_UPLOAD_SIZE_BYTES) continue;
      await saveUpload(file, 'project', editingId, currentBoatId);
    }
    formFileInput.value = '';
    renderFormAttachments();
  });
  addAttachmentBtn.addEventListener('click', () => formFileInput.click());
  listContainer.appendChild(formFileInput);

  function renderFormAttachments() {
    const listEl = document.getElementById('project-form-attachments-list');
    if (!listEl) return;
    const attachments = getUploads('project', editingId, currentBoatId);
    listEl.innerHTML = '';
    attachments.forEach((upload) => {
      const item = document.createElement('div');
      item.className = 'attachment-item';
      item.innerHTML = `
        <div class="attachment-info">
          <div class="attachment-icon">${renderIcon('file')}</div>
          <div class="attachment-details">
            <div class="attachment-name">${escapeHtml(upload.filename)}</div>
          </div>
        </div>
        <div>
          <button type="button" class="btn-link project-form-open" data-upload-id="${upload.id}">Open</button>
          ${!projectsArchived ? `<button type="button" class="btn-link btn-danger project-form-delete" data-upload-id="${upload.id}">${renderIcon('trash')}</button>` : ''}
        </div>
      `;
      listEl.appendChild(item);
    });
    listEl.querySelectorAll('.project-form-open').forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = getUpload(btn.dataset.uploadId);
        if (u) openUpload(u);
      });
    });
    listEl.querySelectorAll('.project-form-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmAction({ title: 'Delete this attachment?', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
        if (!ok) return;
        await deleteUpload(btn.dataset.uploadId);
        renderFormAttachments();
      });
    });
  }
  renderFormAttachments();
}

export default {
  render,
  onMount
};
