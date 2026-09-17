/**
 * PoE Quick Price Checker v1.0.0 - Modular Orchestrator
 * Data-Driven Categories, Pure Event Delegation, Zero Inline Handlers
 */

import { state } from './modules/state.js';
import { Api } from './modules/api.js';
import { Search } from './modules/search.js';
import { Render } from './modules/render.js';
import { Modals } from './modules/modals.js';
import { Clipboard } from './modules/clipboard.js';

// DOM Elements Cache
const dom = {};

function initDom() {
  // Navigation & Game Selector
  dom.sidebarNav = document.getElementById('sidebarNav');
  dom.btnPoe1 = document.getElementById('btnPoe1');
  dom.btnPoe2 = document.getElementById('btnPoe2');
  dom.leagueSelect = document.getElementById('leagueSelect');

  // Rates Ticker & Status
  dom.divinePriceText = document.getElementById('divinePriceText');
  dom.mirrorPriceText = document.getElementById('mirrorPriceText');
  dom.tickerDivineChaos = document.getElementById('tickerDivineChaos');
  dom.tickerMirrorDiv = document.getElementById('tickerMirrorDiv');
  dom.cacheStatusPill = document.getElementById('cacheStatusPill');
  dom.btnRefreshAll = document.getElementById('btnRefreshAll');
  dom.btnRefreshCategory = document.getElementById('btnRefreshCategory');
  dom.btnDiagnostics = document.getElementById('btnDiagnostics');
  dom.btnAlerts = document.getElementById('btnAlerts');
  dom.btnSettings = document.getElementById('btnSettings');
  dom.btnCompareDrawer = document.getElementById('btnCompareDrawer');
  dom.compareCountBadge = document.getElementById('compareCountBadge');

  // Search & Views
  dom.searchInput = document.getElementById('searchInput');
  dom.clearSearchBtn = document.getElementById('clearSearchBtn');
  dom.resultsCount = document.getElementById('resultsCount');
  dom.currentCategoryTitle = document.getElementById('currentCategoryTitle');
  dom.breadcrumbCategory = document.getElementById('breadcrumbCategory');
  dom.filterChips = document.querySelectorAll('.chip-btn');
  dom.viewTableBtn = document.getElementById('viewTableBtn');
  dom.viewGridBtn = document.getElementById('viewGridBtn');
  dom.tableView = document.getElementById('tableView');
  dom.gridView = document.getElementById('gridView');
  dom.itemsTableBody = document.getElementById('itemsTableBody');
  dom.itemsGrid = document.getElementById('itemsGrid');
  dom.pagination = document.getElementById('pagination');

  // Table Sort Headers
  dom.sortHeaders = document.querySelectorAll('.sortable-th');

  // Calculator Modal
  dom.calcModalOverlay = document.getElementById('calcModalOverlay');
  dom.closeCalcModal = document.getElementById('closeCalcModal');
  dom.calcModalIcon = document.getElementById('calcModalIcon');
  dom.calcModalName = document.getElementById('calcModalName');
  dom.calcModalCategory = document.getElementById('calcModalCategory');
  dom.calcWikiLink = document.getElementById('calcWikiLink');
  dom.calcQtyInput = document.getElementById('calcQtyInput');
  dom.calcUnitChaos = document.getElementById('calcUnitChaos');
  dom.calcUnitDivine = document.getElementById('calcUnitDivine');
  dom.calcTotalChaos = document.getElementById('calcTotalChaos');
  dom.calcTotalChaosSym = document.getElementById('calcTotalChaosSym');
  dom.calcTotalDivine = document.getElementById('calcTotalDivine');
  dom.calcTotalDivineSym = document.getElementById('calcTotalDivineSym');
  dom.calcSummaryText = document.getElementById('calcSummaryText');
  dom.btnCopyCalcWhisper = document.getElementById('btnCopyCalcWhisper');
  dom.btnPresetMax = document.getElementById('btnPresetMax');

  // Quick Currency Converter
  dom.convChaosInput = document.getElementById('convChaosInput');
  dom.convDivineInput = document.getElementById('convDivineInput');
  dom.convPrimarySym = document.getElementById('convPrimarySym');
}

// Current categories available for the active game+league
let currentAvailableCategories = [];
let warmingPollTimer = null;

// ==========================================================================
// Initialization & League Boot
// ==========================================================================
async function init() {
  initDom();
  bindEvents();

  // 1. Fetch dynamic leagues list
  await loadLeagues();

  // 2. Fetch data-driven categories and items
  await loadCategoriesAndData();

  // 3. Setup In-Game Paste scanner
  Clipboard.initPasteListener((parsed) => {
    dom.searchInput.value = parsed.searchQuery;
    dom.clearSearchBtn.classList.remove('hidden');
    state.searchQuery = parsed.searchQuery;
    filterAndRender();

    const match = state.filteredItems[0];
    if (match) {
      Clipboard.showToast(`Đã nhận diện: ${match.name}`, 'success');
      Modals.openCalculator(match, state, dom);
    } else {
      Clipboard.showToast(`Đã tìm kiếm: "${parsed.searchQuery}"`, 'info');
    }
  });

  // 4. Background status poll
  setInterval(updateStatusUI, 60000);
}

async function loadLeagues() {
  try {
    const leaguesData = await Api.fetchLeagues();
    state.availableLeagues = leaguesData;
    populateLeagueSelect();
  } catch (err) {
    console.warn('Failed to load dynamic leagues:', err);
  }
}

function populateLeagueSelect() {
  const leagues = state.availableLeagues[state.currentGame] || [];
  dom.leagueSelect.innerHTML = '';

  if (leagues.length === 0) {
    const defaultName = state.currentGame === 'poe2' ? 'Forbidden Rites' : 'Allflame';
    dom.leagueSelect.innerHTML = `<option value="${defaultName}">${defaultName}</option>`;
    state.currentLeague = defaultName;
    return;
  }

  for (const l of leagues) {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    if (l.default) opt.selected = true;
    dom.leagueSelect.appendChild(opt);
  }

  const selected = leagues.find(l => l.default) || leagues[0];
  state.currentLeague = selected.id;
}

// ==========================================================================
// Data-Driven Categories & League Data Loading
// ==========================================================================
async function loadCategoriesAndData() {
  if (warmingPollTimer) {
    clearInterval(warmingPollTimer);
    warmingPollTimer = null;
  }

  await loadCategories();
  await loadData();
}

async function loadCategories() {
  try {
    const res = await Api.fetchCategories(state.currentGame, state.currentLeague);
    currentAvailableCategories = res.categories || [];

    // Check if activeCategory is still available in this league
    const stillValid = currentAvailableCategories.some(c => c.label === state.activeCategory || c.type === state.activeCategory);
    if (!stillValid && currentAvailableCategories.length > 0) {
      state.activeCategory = currentAvailableCategories[0].label;
    }

    renderSidebar();
    dom.breadcrumbCategory.textContent = state.activeCategory;
    dom.currentCategoryTitle.textContent = state.activeCategory;
  } catch (err) {
    console.warn('Failed to fetch categories:', err);
  }
}

async function loadData() {
  dom.resultsCount.textContent = `Đang nạp dữ liệu ${state.currentLeague}...`;
  try {
    const data = await Api.fetchItems(state.currentGame, state.currentLeague);

    if (data.status === 'warming' || data.status === 'discovering') {
      dom.resultsCount.textContent = data.message || `Đang tải và khám phá danh mục cho "${state.currentLeague}"...`;
      state.items = data.items || [];
      filterAndRender();

      // Poll every 2.5s until cache discovery/warming is fully ready
      if (!warmingPollTimer) {
        warmingPollTimer = setInterval(async () => {
          const pollData = await Api.fetchItems(state.currentGame, state.currentLeague);
          if (pollData.status === 'ready') {
            clearInterval(warmingPollTimer);
            warmingPollTimer = null;
            await loadCategories(); // Crucial: Re-fetch categories so newly discovered ones populate the sidebar!
            applyLoadedData(pollData);
          } else if (pollData.items && pollData.items.length > 0) {
            state.items = pollData.items;
            dom.resultsCount.textContent = pollData.message || `Đang khám phá danh mục (${pollData.items.length} items)...`;
            filterAndRender();
          }
        }, 2500);
      }
      return;
    }

    applyLoadedData(data);
  } catch (err) {
    console.error('Failed to load items:', err);
    Clipboard.showToast('Lỗi tải dữ liệu cache', 'error');
    dom.resultsCount.textContent = 'Không thể tải cache.';
  }
}

function applyLoadedData(data) {
  state.items = data.items || [];
  state.rates = {
    divinePriceInChaos: data.divinePriceInChaos || 0,
    mirrorPriceInChaos: data.mirrorPriceInChaos || 0,
    rawRates: data.rates || {}
  };
  state.updatedAt = data.updatedAt;

  renderSidebar();
  updateHeaderRates();
  updateStatusUI();
  filterAndRender();

  // Check Price Alerts after cache loaded
  Modals.checkPriceAlerts(state.items, state);
}

function filterAndRender() {
  state.filteredItems = Search.filterAndRank(state.items, {
    query: state.searchQuery,
    category: state.activeCategory,
    subCategory: state.activeSubCategory,
    priceFilter: state.priceFilter,
    onlyFavorites: state.onlyFavorites,
    favoritesSet: state.favorites,
    game: state.currentGame
  });

  // Apply column sorting (if not searching with relevance score)
  if (!state.searchQuery.trim()) {
    applySort(state.filteredItems);
  }

  state.currentPage = 1;
  renderCurrentView();
  updateHeaderRates();
}

function applySort(items) {
  const col = state.sortColumn;
  const dir = state.sortDirection === 'asc' ? 1 : -1;

  items.sort((a, b) => {
    if (col === 'name') {
      return dir * a.name.localeCompare(b.name);
    }
    if (col === 'value') {
      const valA = state.currentGame === 'poe2' ? (a.divineValue || 0) : (a.chaosValue || 0);
      const valB = state.currentGame === 'poe2' ? (b.divineValue || 0) : (b.chaosValue || 0);
      return dir * (valA - valB);
    }
    if (col === 'change7d') {
      return dir * ((a.change7d || 0) - (b.change7d || 0));
    }
    if (col === 'volume') {
      return dir * ((a.volume || 0) - (b.volume || 0));
    }
    return 0;
  });
}

function renderCurrentView() {
  const total = state.filteredItems.length;
  dom.resultsCount.textContent = `${total.toLocaleString()} vật phẩm`;

  const totalPages = Math.ceil(total / state.pageSize) || 1;
  const startIdx = (state.currentPage - 1) * state.pageSize;
  const pageItems = state.filteredItems.slice(startIdx, startIdx + state.pageSize);

  if (state.currentView === 'table') {
    dom.tableView.classList.remove('hidden');
    dom.gridView.classList.add('hidden');
    dom.itemsTableBody.innerHTML = Render.renderTableRows(pageItems, state);
  } else {
    dom.tableView.classList.add('hidden');
    dom.gridView.classList.remove('hidden');
    dom.itemsGrid.innerHTML = Render.renderGridCards(pageItems, state);
  }

  dom.pagination.innerHTML = Render.renderPagination(state.currentPage, totalPages);
  updateCompareBadge();
}

// ==========================================================================
// UI Updates & Dynamic Sidebar
// ==========================================================================
function renderSidebar() {
  dom.sidebarNav.innerHTML = '';

  for (const cat of currentAvailableCategories) {
    const count = state.items.filter(i => i.category === cat.label || i.sourceType === cat.type).length;
    const btn = document.createElement('button');
    btn.className = `nav-item ${state.activeCategory === cat.label ? 'active' : ''}`;
    btn.dataset.category = cat.label;

    btn.innerHTML = `
      <div class="nav-item-left">
        <span class="category-icon ${cat.iconClass}"></span>
        <span class="category-label">${cat.label}</span>
      </div>
      <span class="category-count">${count}</span>
    `;

    dom.sidebarNav.appendChild(btn);
  }
}

function updateHeaderRates() {
  const isPoe2 = state.currentGame === 'poe2';
  if (isPoe2) {
    const exRate = state.rates.rawRates?.exalted || 0;
    dom.divinePriceText.textContent = exRate > 0 ? `${exRate} Ex` : '...';
    dom.tickerDivineChaos.innerHTML = `1 <span style="color:#f2a93b;">Div</span> = <strong>${exRate > 0 ? exRate : '...'}</strong> Ex`;
    dom.tickerMirrorDiv.innerHTML = `1 <span style="color:#f2a93b;">Mirror</span> = <strong>~22k</strong> Div`;
    dom.convPrimarySym.textContent = 'Ex';
  } else {
    const divChaos = state.rates.divinePriceInChaos;
    if (divChaos > 0) {
      dom.divinePriceText.textContent = `${divChaos.toLocaleString()} C`;
      dom.tickerDivineChaos.innerHTML = `1 <span style="color:#f2a93b;">Div</span> = <strong>${divChaos.toLocaleString()}</strong> C`;
    }
    if (state.rates.mirrorPriceInChaos > 0 && divChaos > 0) {
      const mirrorInDiv = Math.round(state.rates.mirrorPriceInChaos / divChaos);
      dom.mirrorPriceText.textContent = `${mirrorInDiv.toLocaleString()} Div`;
    }
    dom.convPrimarySym.textContent = 'C';
  }
}

async function updateStatusUI() {
  try {
    const status = await Api.fetchStatus();
    state.rotationInfo = status;

    if (status.isRefreshing) {
      dom.cacheStatusPill.className = 'cache-status-pill syncing';
      dom.cacheStatusPill.innerHTML = '<span class="status-dot"></span><span>Đang tải...</span>';
    } else {
      const isStale = status.summary?.[state.currentGame]?.[state.currentLeague]?.isStale;
      dom.cacheStatusPill.className = `cache-status-pill ${isStale ? 'warning' : 'synced'}`;
      dom.cacheStatusPill.innerHTML = `<span class="status-dot"></span><span>5p Xoay tua | 30p Core ${isStale ? '(Stale)' : ''}</span>`;
    }
  } catch (e) {}
}

function updateCompareBadge() {
  const count = state.compareList.size;
  dom.compareCountBadge.textContent = count;
  if (count > 0) {
    dom.btnCompareDrawer.classList.remove('hidden');
  } else {
    dom.btnCompareDrawer.classList.add('hidden');
  }
}

// ==========================================================================
// Event Delegation Handlers (Pure & Safe)
// ==========================================================================
function bindEvents() {
  // Global Image Error Fallback (Safe, zero inline onerror)
  document.body.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && (e.target.classList.contains('item-thumb') || e.target.classList.contains('grid-item-thumb'))) {
      e.target.src = 'https://web.poecdn.com/image/Art/2DItems/Currency/CurrencyRerollRare.png';
    }
  }, true);

  // Game Selector
  dom.btnPoe1.addEventListener('click', () => switchGame('poe1'));
  dom.btnPoe2.addEventListener('click', () => switchGame('poe2'));

  // League Selector
  dom.leagueSelect.addEventListener('change', (e) => {
    state.currentLeague = e.target.value;
    loadCategoriesAndData();
  });

  // Sidebar Category Delegation
  dom.sidebarNav.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-item');
    if (!btn) return;
    const cat = btn.dataset.category;
    if (!cat) return;

    state.activeCategory = cat;
    state.onlyFavorites = false;
    document.querySelectorAll('.chip-btn').forEach(c => c.classList.remove('active'));
    document.querySelector('.chip-btn[data-filter="all"]')?.classList.add('active');

    dom.sidebarNav.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    dom.breadcrumbCategory.textContent = cat;
    dom.currentCategoryTitle.textContent = cat;
    filterAndRender();
  });

  // Search Input
  dom.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    dom.clearSearchBtn.classList.toggle('hidden', !state.searchQuery);
    filterAndRender();
  });

  dom.clearSearchBtn.addEventListener('click', () => {
    dom.searchInput.value = '';
    state.searchQuery = '';
    dom.clearSearchBtn.classList.add('hidden');
    filterAndRender();
  });

  // Filter Chips Delegation
  document.querySelector('.filter-chips-wrap')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-btn');
    if (!chip) return;

    dom.filterChips.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const filter = chip.dataset.filter;
    if (filter === 'fav') {
      state.onlyFavorites = true;
      state.priceFilter = 'all';
    } else {
      state.onlyFavorites = false;
      state.priceFilter = filter;
    }
    filterAndRender();
  });

  // Views Toggle
  dom.viewTableBtn.addEventListener('click', () => switchView('table'));
  dom.viewGridBtn.addEventListener('click', () => switchView('grid'));

  // Table Sort Delegation
  document.querySelector('.items-table-header')?.addEventListener('click', (e) => {
    const th = e.target.closest('.sortable-th');
    if (!th) return;
    const col = th.dataset.sort;
    if (!col) return;

    if (state.sortColumn === col) {
      state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      state.sortColumn = col;
      state.sortDirection = 'desc';
    }

    dom.sortHeaders.forEach(h => {
      h.classList.remove('sorted-asc', 'sorted-desc');
      if (h.dataset.sort === state.sortColumn) {
        h.classList.add(`sorted-${state.sortDirection}`);
      }
    });

    applySort(state.filteredItems);
    renderCurrentView();
  });

  // Table Body Delegation
  dom.itemsTableBody.addEventListener('click', handleItemAction);
  dom.itemsGrid.addEventListener('click', handleItemAction);

  // Pagination Delegation
  dom.pagination.addEventListener('click', (e) => {
    const btn = e.target.closest('.pg-btn');
    if (!btn || btn.classList.contains('disabled')) return;

    const action = btn.dataset.action;
    const totalPages = Math.ceil(state.filteredItems.length / state.pageSize) || 1;

    if (action === 'page-prev' && state.currentPage > 1) {
      state.currentPage--;
    } else if (action === 'page-next' && state.currentPage < totalPages) {
      state.currentPage++;
    } else if (action === 'page-goto') {
      state.currentPage = parseInt(btn.dataset.page, 10) || 1;
    }
    renderCurrentView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Per-category Refresh
  dom.btnRefreshCategory.addEventListener('click', async () => {
    dom.btnRefreshCategory.classList.add('fa-spin');
    Clipboard.showToast(`Đang làm mới danh mục "${state.activeCategory}"...`);
    try {
      await Api.refreshCategory(state.currentGame, state.currentLeague, state.activeCategory);
      await loadCategoriesAndData();
      Clipboard.showToast(`Đã làm mới "${state.activeCategory}" thành công!`, 'success');
    } catch (err) {
      Clipboard.showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      dom.btnRefreshCategory.classList.remove('fa-spin');
    }
  });

  // Full Refresh with Status Polling (No blind setTimeout!)
  dom.btnRefreshAll.addEventListener('click', async () => {
    dom.btnRefreshAll.classList.add('fa-spin');
    Clipboard.showToast('Bắt đầu đồng bộ toàn bộ cache...');
    try {
      await Api.refreshAll();
      
      // Poll /api/status until isRefreshing becomes false
      const pollInterval = setInterval(async () => {
        const st = await Api.fetchStatus();
        if (!st.isRefreshing) {
          clearInterval(pollInterval);
          dom.btnRefreshAll.classList.remove('fa-spin');
          await loadCategoriesAndData();
          Clipboard.showToast('Đã hoàn tất đồng bộ toàn bộ cache!', 'success');
        }
      }, 1500);
    } catch (err) {
      dom.btnRefreshAll.classList.remove('fa-spin');
      Clipboard.showToast('Không thể kích hoạt làm mới cache', 'error');
    }
  });

  // Diagnostics Modal Trigger
  dom.btnDiagnostics.addEventListener('click', async () => {
    const status = await Api.fetchStatus();
    Modals.openDiagnostics(status);
  });
  document.getElementById('closeDiagnosticsModal')?.addEventListener('click', Modals.closeDiagnostics);

  // Compare Drawer & Modal Trigger
  dom.btnCompareDrawer.addEventListener('click', () => Modals.openCompare(state, dom));
  document.getElementById('closeCompareModal')?.addEventListener('click', Modals.closeCompare);
  document.getElementById('btnClearCompare')?.addEventListener('click', () => {
    state.clearCompare();
    Modals.closeCompare();
    renderCurrentView();
  });
  document.getElementById('compareTableContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="remove-compare"]');
    if (!btn) return;
    const id = btn.dataset.id;
    state.compareList.delete(id);
    Modals.openCompare(state, dom);
    renderCurrentView();
  });

  // Price Alerts Modal Trigger
  dom.btnAlerts.addEventListener('click', () => Modals.openAlerts(state));
  document.getElementById('closeAlertsModal')?.addEventListener('click', Modals.closeAlerts);
  document.getElementById('btnAddAlert')?.addEventListener('click', () => {
    const itemName = document.getElementById('newAlertItemName')?.value.trim();
    const condition = document.getElementById('newAlertCondition')?.value;
    const threshold = parseFloat(document.getElementById('newAlertThreshold')?.value);
    const currency = document.getElementById('newAlertCurrency')?.value;

    if (!itemName || isNaN(threshold) || threshold <= 0) {
      Clipboard.showToast('Vui lòng nhập tên vật phẩm và ngưỡng giá hợp lệ!', 'warning');
      return;
    }

    state.addAlert({ itemName, condition, threshold, currency });
    document.getElementById('newAlertItemName').value = '';
    document.getElementById('newAlertThreshold').value = '';
    Modals.renderAlertsList(state);
    Clipboard.showToast(`Đã thêm cảnh báo cho "${itemName}"!`, 'success');
  });
  document.getElementById('alertsListContainer')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="delete-alert"]');
    if (!btn) return;
    const id = btn.dataset.id;
    state.removeAlert(id);
    Modals.renderAlertsList(state);
    Clipboard.showToast('Đã xóa cảnh báo.', 'info');
  });

  // Settings Modal Trigger & Overlay Dismissal
  dom.btnSettings.addEventListener('click', () => Modals.openSettings(state));
  document.getElementById('closeSettingsModal')?.addEventListener('click', () => Modals.closeSettings());
  document.getElementById('settingsModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'settingsModalOverlay') Modals.closeSettings();
  });
  document.getElementById('btnSaveSettings')?.addEventListener('click', (e) => {
    e.preventDefault();
    const game = document.getElementById('settingDefaultGame')?.value;
    const view = document.getElementById('settingDefaultView')?.value;
    state.saveSettings({ defaultGame: game, defaultView: view });
    Modals.closeSettings();
    Clipboard.showToast('Đã lưu tùy chọn thành công!', 'success');
  });

  // Compare & Alerts & Diagnostics Backdrop Dismissals
  document.getElementById('compareModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'compareModalOverlay') Modals.closeCompare();
  });
  document.getElementById('alertsModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'alertsModalOverlay') Modals.closeAlerts();
  });
  document.getElementById('diagnosticsModalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'diagnosticsModalOverlay') Modals.closeDiagnostics();
  });

  // Calculator Modal Events
  dom.closeCalcModal.addEventListener('click', () => Modals.closeCalculator(dom));
  dom.calcModalOverlay.addEventListener('click', (e) => {
    if (e.target === dom.calcModalOverlay) Modals.closeCalculator(dom);
  });
  dom.calcQtyInput.addEventListener('input', () => {
    Modals.updateCalculatorValues(state.activeModalItem, dom.calcQtyInput.value, state, dom);
  });

  // Calculator Presets Delegation
  document.querySelector('.calc-presets-row')?.addEventListener('click', (e) => {
    const btn = e.target.closest('.preset-btn');
    if (!btn) return;

    let qty = parseInt(dom.calcQtyInput.value, 10) || 0;
    const preset = btn.dataset.preset;

    if (preset === '1') qty = 1;
    else if (preset === '5') qty += 5;
    else if (preset === '10') qty += 10;
    else if (preset === '20') qty += 20;
    else if (preset === 'max') qty = parseInt(btn.dataset.stack, 10) || 10;
    else if (preset === 'reset') qty = 1;

    dom.calcQtyInput.value = Math.max(1, qty);
    Modals.updateCalculatorValues(state.activeModalItem, dom.calcQtyInput.value, state, dom);
  });

  // Calculator Copy Price Button
  dom.btnCopyCalcWhisper.addEventListener('click', async () => {
    if (!state.activeModalItem) return;
    const qty = parseInt(dom.calcQtyInput.value, 10) || 1;
    const isPoe2 = state.currentGame === 'poe2';
    const priceText = isPoe2 ? 
      `${dom.calcTotalChaos.textContent} Ex (${dom.calcTotalDivine.textContent} Div)` : 
      `${dom.calcTotalChaos.textContent} C`;

    const whisper = Clipboard.formatWhisper(state.activeModalItem, qty, priceText);
    const success = await Clipboard.copyText(whisper);
    if (success) {
      dom.btnCopyCalcWhisper.innerHTML = '<i class="fa-solid fa-check"></i> Đã sao chép!';
      dom.btnCopyCalcWhisper.classList.add('copied');
      setTimeout(() => {
        dom.btnCopyCalcWhisper.innerHTML = '<i class="fa-solid fa-copy"></i> Sao chép whisper';
        dom.btnCopyCalcWhisper.classList.remove('copied');
      }, 1800);
      Clipboard.showToast(`Đã sao chép tin nhắn whisper!`, 'success');
    }
  });

  // Quick Currency Converter Inputs
  dom.convChaosInput.addEventListener('input', () => {
    const isPoe2 = state.currentGame === 'poe2';
    const val = parseFloat(dom.convChaosInput.value) || 0;
    if (isPoe2) {
      const exRate = state.rates.rawRates?.exalted || 1;
      dom.convDivineInput.value = exRate > 0 ? +(val / exRate).toFixed(3) : 0;
    } else {
      const divChaos = state.rates.divinePriceInChaos;
      dom.convDivineInput.value = divChaos > 0 ? +(val / divChaos).toFixed(3) : 0;
    }
  });

  dom.convDivineInput.addEventListener('input', () => {
    const isPoe2 = state.currentGame === 'poe2';
    const val = parseFloat(dom.convDivineInput.value) || 0;
    if (isPoe2) {
      const exRate = state.rates.rawRates?.exalted || 1;
      dom.convChaosInput.value = +(val * exRate).toFixed(1);
    } else {
      const divChaos = state.rates.divinePriceInChaos;
      dom.convChaosInput.value = +(val * divChaos).toFixed(1);
    }
  });

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      Modals.closeCalculator(dom);
      Modals.closeCompare();
      Modals.closeAlerts();
      Modals.closeDiagnostics();
      Modals.closeSettings();
    } else if (e.key === '/' && document.activeElement !== dom.searchInput) {
      e.preventDefault();
      dom.searchInput.focus();
      dom.searchInput.select();
    } else if (e.key === 'Enter' && document.activeElement === dom.searchInput) {
      if (state.filteredItems.length > 0) {
        Modals.openCalculator(state.filteredItems[0], state, dom);
      }
    }
  });
}

// Action Dispatcher for Table and Grid items
function handleItemAction(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id;
  const item = state.items.find(i => i.id === id);
  if (!item) return;

  if (action === 'open-calc') {
    Modals.openCalculator(item, state, dom);
  } else if (action === 'toggle-fav') {
    e.stopPropagation();
    const isFav = state.toggleFavorite(item.id);
    Clipboard.showToast(isFav ? `★ Đã thêm "${item.name}" vào yêu thích` : `Đã xóa "${item.name}" khỏi yêu thích`);
    renderCurrentView();
  } else if (action === 'toggle-compare') {
    e.stopPropagation();
    const res = state.toggleCompare(item);
    if (res === 'limit_reached') {
      Clipboard.showToast('Bạn chỉ có thể so sánh tối đa 5 vật phẩm cùng lúc!', 'warning');
      target.checked = false;
      return;
    }
    renderCurrentView();
  }
}

async function switchGame(game) {
  if (state.currentGame === game) return;
  state.currentGame = game;
  state.activeCategory = 'Currency';

  dom.btnPoe1.classList.toggle('active', game === 'poe1');
  dom.btnPoe2.classList.toggle('active', game === 'poe2');

  populateLeagueSelect();
  await loadCategoriesAndData();
  Clipboard.showToast(`Chuyển sang ${game.toUpperCase()}`);
}

function switchView(view) {
  state.currentView = view;
  dom.viewTableBtn.classList.toggle('active', view === 'table');
  dom.viewGridBtn.classList.toggle('active', view === 'grid');
  renderCurrentView();
}

// Boot
window.addEventListener('DOMContentLoaded', init);
