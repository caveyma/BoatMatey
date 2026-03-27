function isInteractiveTarget(target) {
  return !!target?.closest('a, button, input, select, textarea, label');
}

const listState = new Map(); // key -> { expandAll: boolean, expandedIds: Set<string> }

function getListState(listContainer) {
  const key = listContainer.id || listContainer.dataset.expandKey || `list_${Math.random().toString(36).slice(2, 9)}`;
  listContainer.dataset.expandKey = key;
  if (!listState.has(key)) {
    listState.set(key, { expandAll: false, expandedIds: new Set() });
  }
  return { key, state: listState.get(key) };
}

function ensureExpandAllControl(listContainer, state, renderAllCards) {
  const toolsHost = listContainer.previousElementSibling?.classList?.contains('list-tools')
    ? listContainer.previousElementSibling
    : null;
  const parent = listContainer.parentElement;
  if (!parent) return;

  let btn = parent.querySelector('.record-expand-all-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-link record-expand-all-btn';
    btn.style.alignSelf = 'flex-start';
    btn.style.margin = '0 0 0.5rem 0';
    // Place at the top area: in list-tools when available, otherwise right above the list container.
    if (toolsHost) {
      toolsHost.appendChild(btn);
    } else {
      parent.insertBefore(btn, listContainer);
    }
  }
  btn.textContent = state.expandAll ? 'Collapse all' : 'Expand all';
  btn.onclick = (e) => {
    e.preventDefault();
    state.expandAll = !state.expandAll;
    state.expandedIds.clear();
    btn.textContent = state.expandAll ? 'Collapse all' : 'Expand all';
    renderAllCards();
  };
}

export function enableRecordCardExpand(listContainer) {
  if (!listContainer) return;
  const { state } = getListState(listContainer);
  const cards = listContainer.querySelectorAll(':scope > .card');

  const renderAllCards = () => enableRecordCardExpand(listContainer);
  ensureExpandAllControl(listContainer, state, renderAllCards);

  cards.forEach((card) => {
    const header = card.querySelector(':scope > .card-header');
    if (!header) return;

    const details = Array.from(card.children).filter((el) => !el.classList.contains('card-header'));
    if (!details.length) return;

    let detailsWrap = card.querySelector(':scope > .record-expand-details');
    if (!detailsWrap) {
      detailsWrap = document.createElement('div');
      detailsWrap.className = 'record-expand-details';
      details.forEach((el) => detailsWrap.appendChild(el));
      card.appendChild(detailsWrap);
    }

    const summaryArea = header.firstElementChild || header;
    summaryArea.classList.add('record-expand-hitarea');
    summaryArea.classList.add('record-expand-summary');
    if (!summaryArea.getAttribute('title')) summaryArea.setAttribute('title', 'Click to expand');

    let toggleBtn = header.querySelector(':scope .record-expand-toggle');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.className = 'record-expand-toggle';
      toggleBtn.setAttribute('aria-label', 'Expand details');
      toggleBtn.innerHTML = '<span class="record-expand-chevron" aria-hidden="true">▶</span>';
      summaryArea.prepend(toggleBtn);
    }

    const cardId =
      card.dataset.itemId ||
      card.dataset.linkId ||
      card.dataset.serviceId ||
      card.dataset.navId ||
      card.dataset.safetyId ||
      card.dataset.hauloutId ||
      card.dataset.logId ||
      card.querySelector('a[href*="/"]')?.getAttribute('href') ||
      Math.random().toString(36).slice(2, 10);

    const setExpanded = (expanded) => {
      card.classList.toggle('record-expanded', expanded);
      const chevron = toggleBtn.querySelector('.record-expand-chevron');
      if (chevron) chevron.classList.toggle('is-expanded', expanded);
      toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggleBtn.setAttribute('aria-label', expanded ? 'Collapse details' : 'Expand details');
      summaryArea.setAttribute('title', expanded ? 'Click to collapse' : 'Click to expand');
    };

    // Default compact view for all record lists.
    setExpanded(state.expandAll || state.expandedIds.has(String(cardId)));

    toggleBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = !card.classList.contains('record-expanded');
      setExpanded(next);
      if (!state.expandAll) {
        if (next) state.expandedIds.add(String(cardId));
        else state.expandedIds.delete(String(cardId));
      }
    };

    summaryArea.onclick = (e) => {
      if (isInteractiveTarget(e.target)) return;
      const next = !card.classList.contains('record-expanded');
      setExpanded(next);
      if (!state.expandAll) {
        if (next) state.expandedIds.add(String(cardId));
        else state.expandedIds.delete(String(cardId));
      }
    };
  });
}
