/**
 * Projects Page
 * Plan and track boat projects/upgrades (planned or in-progress, not completed maintenance).
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
  LIMITED_UPLOAD_SIZE_BYTES,
  LIMITED_UPLOADS_PER_ENTITY
} from '../lib/uploads.js';

const CATEGORIES = ['Electronics', 'Mechanical', 'Plumbing', 'Electrical', 'Hull / Deck', 'Interior', 'Safety', 'Other'];
const STATUSES = ['Idea', 'Planning', 'Parts Ordered', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'];
const PRIORITIES = ['Low', 'Medium', 'High'];

let editingId = null;
let currentBoatId = null;
let projectsArchived = false;
let filterStatus = '';
let filterPriority = '';
let filterCategory = '';
let sortBy = 'target_date'; // target_date | status | priority | category
let projectFileInput = null;
let currentProjectIdForUpload = null;

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
    isEditPage ? (projectId === 'new' ? 'Add Project' : 'Edit Project') : 'Projects'
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
  addBtn.innerHTML = `${renderIcon('plus')} Add Project`;
  addBtn.onclick = () => navigate(`/boat/${currentBoatId}/projects/new`);

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
        ${STATUSES.map((s) => `<option value="${s}">${s}</option>`).join('')}
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
      <label for="sort-by">Sort by</label>
      <select id="sort-by">
        <option value="target_date">Target date</option>
        <option value="status">Status</option>
        <option value="priority">Priority</option>
        <option value="category">Category</option>
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

  container.appendChild(addBtn);
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

  if (projectId) {
    editingId = projectId === 'new' ? `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : projectId;
    await showProjectForm();
    return;
  }

  const addBtn = document.getElementById('projects-add-btn');
  if (addBtn && projectsArchived) addBtn.style.display = 'none';

  projectFileInput = document.getElementById('projects-file-input');
  if (projectFileInput) {
    projectFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length || !currentBoatId || !currentProjectIdForUpload) return;
      const existing = getUploads('project', currentProjectIdForUpload, currentBoatId);
      const remainingSlots = LIMITED_UPLOADS_PER_ENTITY - existing.length;
      if (remainingSlots <= 0) {
        showToast(`You can only upload up to ${LIMITED_UPLOADS_PER_ENTITY} files for this project.`, 'error');
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
  const sortByEl = document.getElementById('sort-by');
  if (filterStatusEl) filterStatusEl.addEventListener('change', () => { filterStatus = filterStatusEl.value; loadProjects(); });
  if (filterPriorityEl) filterPriorityEl.addEventListener('change', () => { filterPriority = filterPriorityEl.value; loadProjects(); });
  if (filterCategoryEl) filterCategoryEl.addEventListener('change', () => { filterCategory = filterCategoryEl.value; loadProjects(); });
  if (sortByEl) sortByEl.addEventListener('change', () => { sortBy = sortByEl.value; loadProjects(); });

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

function priorityClass(priority) {
  if (priority === 'High') return 'priority-high';
  if (priority === 'Medium') return 'priority-medium';
  return 'priority-low';
}

async function loadProjects() {
  const listContainer = document.getElementById('projects-list');
  let projects = currentBoatId ? await getProjects(currentBoatId) : [];

  if (filterStatus) projects = projects.filter((p) => p.status === filterStatus);
  if (filterPriority) projects = projects.filter((p) => p.priority === filterPriority);
  if (filterCategory) projects = projects.filter((p) => p.category === filterCategory);

  if (sortBy === 'target_date') {
    projects = [...projects].sort((a, b) => {
      const da = a.target_date ? new Date(a.target_date).getTime() : 0;
      const db = b.target_date ? new Date(b.target_date).getTime() : 0;
      if (da !== db) return da - db;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  } else if (sortBy === 'status') {
    const order = { Idea: 0, Planning: 1, 'Parts Ordered': 2, Scheduled: 3, 'In Progress': 4, Completed: 5, Cancelled: 6 };
    projects = [...projects].sort((a, b) => (order[a.status] ?? 7) - (order[b.status] ?? 7));
  } else if (sortBy === 'priority') {
    const order = { High: 0, Medium: 1, Low: 2 };
    projects = [...projects].sort((a, b) => (order[a.priority] ?? 3) - (order[b.priority] ?? 3));
  } else if (sortBy === 'category') {
    projects = [...projects].sort((a, b) => (a.category || '').localeCompare(b.category || ''));
  }

  const filterStatusEl = document.getElementById('filter-status');
  const filterPriorityEl = document.getElementById('filter-priority');
  const filterCategoryEl = document.getElementById('filter-category');
  const sortByEl = document.getElementById('sort-by');
  if (filterStatusEl) filterStatusEl.value = filterStatus;
  if (filterPriorityEl) filterPriorityEl.value = filterPriority;
  if (filterCategoryEl) filterCategoryEl.value = filterCategory;
  if (sortByEl) sortByEl.value = sortBy;

  if (!projects || projects.length === 0) {
    listContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${renderIcon('clipboard')}</div>
        <p>No projects yet</p>
        ${!projectsArchived ? `<div class="empty-state-actions"><button type="button" class="btn-primary" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/projects/new')">${renderIcon('plus')} Add Project</button></div>` : ''}
      </div>
    `;
    return;
  }

  listContainer.innerHTML = projects
    .map((p) => {
      const targetStr = p.target_date ? new Date(p.target_date).toLocaleDateString() : '';
      const completedStr = p.completed_date ? new Date(p.completed_date).toLocaleDateString() : '';
      const estCost = p.estimated_cost != null ? `${currencySymbol(p.estimated_cost_currency)}${Number(p.estimated_cost).toFixed(2)}` : '';
      const actCost = p.actual_cost != null ? `${currencySymbol(p.actual_cost_currency)}${Number(p.actual_cost).toFixed(2)}` : '';
      const prioritySpan = p.priority ? `<span class="project-priority ${priorityClass(p.priority)}">${escapeHtml(p.priority)}</span>` : '';
      return `
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">${escapeHtml(p.project_name)}</h3>
            <p class="text-muted">${escapeHtml(p.category || '')} ${prioritySpan ? ' · ' : ''} ${prioritySpan}</p>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <span class="${statusBadgeClass(p.status)}">${escapeHtml(p.status || '—')}</span>
            ${!projectsArchived ? `
            <a href="#/boat/${currentBoatId}/projects/${p.id}" class="btn-link" onclick="event.preventDefault(); window.navigate('/boat/${currentBoatId}/projects/${p.id}')">${renderIcon('edit')}</a>
            <button class="btn-link btn-danger" onclick="projectsPageDelete('${p.id}')">${renderIcon('trash')}</button>
            ` : ''}
          </div>
        </div>
        <div>
          ${p.description ? `<p>${escapeHtml(p.description).replace(/\n/g, '<br>')}</p>` : ''}
          ${targetStr ? `<p><strong>Target:</strong> ${targetStr}</p>` : ''}
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
    const ok = await confirmAction({ title: 'Delete this project?', message: 'This cannot be undone.', confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
    if (!ok) return;
    await deleteProject(id);
    loadProjects();
    showToast('Project removed', 'info');
  };
  window.projectsPageAddAttachment = (projectId) => {
    currentProjectIdForUpload = projectId;
    if (projectFileInput) projectFileInput.click();
  };
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
      deleteUpload(btn.dataset.uploadId);
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
      <h3>${existing ? 'Edit Project' : 'Add Project'}</h3>
      <form id="project-form">
        <div class="form-group">
          <label for="project_name">Project name *</label>
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
              ${STATUSES.map((s) => `<option value="${s}" ${entry?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
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
        <div class="form-row">
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
          <button type="submit" class="btn-primary" id="project-form-save">${existing ? 'Save changes' : 'Add project'}</button>
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

  if (projectsArchived) {
    form.querySelectorAll('input, select, textarea').forEach((el) => { el.disabled = true; });
    saveBtn.style.display = 'none';
    addAttachmentBtn.style.display = 'none';
  }

  cancelBtn.addEventListener('click', () => navigate(`/boat/${currentBoatId}/projects`));

  function getFormPayload() {
    const estCost = document.getElementById('project_estimated_cost').value;
    const actCost = document.getElementById('project_actual_cost').value;
    return {
      id: editingId,
      project_name: document.getElementById('project_name').value.trim(),
      category: document.getElementById('project_category').value || null,
      description: document.getElementById('project_description').value.trim() || null,
      status: document.getElementById('project_status').value || null,
      priority: document.getElementById('project_priority').value || null,
      target_date: document.getElementById('project_target_date').value || null,
      completed_date: document.getElementById('project_completed_date').value || null,
      estimated_cost: estCost === '' ? null : parseFloat(estCost),
      estimated_cost_currency: document.getElementById('project_estimated_cost_currency').value || 'GBP',
      actual_cost: actCost === '' ? null : parseFloat(actCost),
      actual_cost_currency: document.getElementById('project_actual_cost_currency').value || 'GBP',
      supplier_installer: document.getElementById('project_supplier_installer').value.trim() || null,
      notes: document.getElementById('project_notes').value.trim() || null
    };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (projectsArchived) return;
    const payload = getFormPayload();
    if (!payload.project_name) {
      showToast('Project name is required', 'error');
      return;
    }
    setSaveButtonLoading(saveBtn, true);
    try {
      const isNew = !existing || existing.id !== editingId;
      if (isNew) {
        await createProject(currentBoatId, payload);
        showToast('Project added', 'success');
      } else {
        await updateProject(editingId, payload);
        showToast('Project updated', 'success');
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
      showToast(`Max ${LIMITED_UPLOADS_PER_ENTITY} files per project.`, 'error');
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
        deleteUpload(btn.dataset.uploadId);
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
