// ==========================================================================
// 2. Mustache.js Dynamic HTML Rendering Engine & Template Registry
// ==========================================================================
// If Mustache.js is loaded via CDN (<script src="...mustache.min.js"> in index.html),
// window.Mustache is used. If offline or in testing environments, this lightweight
// compliant fallback ensures seamless rendering without external dependencies.
if (typeof Mustache === 'undefined') {
  (function (global) {
    const entityMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => entityMap[c]);
    }

    function lookup(contextStack, name) {
      if (name === '.') return contextStack[contextStack.length - 1];
      const names = name.split('.');
      for (let i = contextStack.length - 1; i >= 0; i--) {
        let curr = contextStack[i];
        let found = true;
        for (let j = 0; j < names.length; j++) {
          if (curr != null && typeof curr === 'object' && names[j] in curr) {
            curr = curr[names[j]];
          } else {
            found = false;
            break;
          }
        }
        if (found) return curr;
      }
      return undefined;
    }

    function findClosingSection(template, sectionName, startIndex) {
      const openHash = `{{#${sectionName}}}`;
      const openCaret = `{{^${sectionName}}}`;
      const closeTag = `{{/${sectionName}}}`;
      let depth = 1;
      let idx = startIndex;

      while (depth > 0 && idx < template.length) {
        const nextClose = template.indexOf(closeTag, idx);
        if (nextClose === -1) return -1;

        let nextOpen = -1;
        const nextHash = template.indexOf(openHash, idx);
        const nextCaret = template.indexOf(openCaret, idx);
        if (nextHash !== -1 && (nextCaret === -1 || nextHash < nextCaret)) {
          nextOpen = nextHash;
        } else if (nextCaret !== -1) {
          nextOpen = nextCaret;
        }

        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          idx = nextOpen + (template.charAt(nextOpen + 2) === '#' ? openHash.length : openCaret.length);
        } else {
          depth--;
          if (depth === 0) return nextClose;
          idx = nextClose + closeTag.length;
        }
      }
      return -1;
    }

    function renderTokens(template, contextStack) {
      let output = '';
      let index = 0;
      const len = template.length;

      while (index < len) {
        const openIdx = template.indexOf('{{', index);
        if (openIdx === -1) {
          output += template.slice(index);
          break;
        }
        output += template.slice(index, openIdx);

        if (template.slice(openIdx, openIdx + 3) === '{{{') {
          const closeIdx = template.indexOf('}}}', openIdx + 3);
          if (closeIdx === -1) { output += template.slice(openIdx); break; }
          const rawTag = template.slice(openIdx + 3, closeIdx).trim();
          const val = lookup(contextStack, rawTag);
          if (val != null) output += val;
          index = closeIdx + 3;
          continue;
        }

        const closeIdx = template.indexOf('}}', openIdx + 2);
        if (closeIdx === -1) { output += template.slice(openIdx); break; }
        const tagContent = template.slice(openIdx + 2, closeIdx).trim();
        index = closeIdx + 2;
        if (!tagContent) continue;

        const firstChar = tagContent.charAt(0);
        if (firstChar === '!') {
          continue;
        } else if (firstChar === '&') {
          const rawTag = tagContent.slice(1).trim();
          const val = lookup(contextStack, rawTag);
          if (val != null) output += val;
        } else if (firstChar === '#' || firstChar === '^') {
          const isSection = firstChar === '#';
          const sectionName = tagContent.slice(1).trim();
          const closeTagIdx = findClosingSection(template, sectionName, index);
          if (closeTagIdx === -1) continue;

          const sectionBody = template.slice(index, closeTagIdx);
          const closeTagStr = `{{/${sectionName}}}`;
          index = closeTagIdx + closeTagStr.length;

          const val = lookup(contextStack, sectionName);

          if (isSection) {
            if (Array.isArray(val)) {
              for (let k = 0; k < val.length; k++) {
                output += renderTokens(sectionBody, contextStack.concat([val[k]]));
              }
            } else if (val) {
              const newCtx = typeof val === 'object' ? val : {};
              output += renderTokens(sectionBody, contextStack.concat([newCtx]));
            }
          } else {
            if (!val || (Array.isArray(val) && val.length === 0)) {
              output += renderTokens(sectionBody, contextStack);
            }
          }
        } else {
          const val = lookup(contextStack, tagContent);
          if (val != null) output += escapeHtml(val);
        }
      }
      return output;
    }

    const mustacheEngine = {
      render: function (tmpl, ctx) {
        if (!tmpl) return '';
        return renderTokens(tmpl, [ctx || {}]);
      }
    };

    global.Mustache = mustacheEngine;
    if (typeof window !== 'undefined') window.Mustache = mustacheEngine;
  })(typeof window !== 'undefined' ? window : globalThis);
}

// Built-in template fallbacks matching the <script type="x-tmpl-mustache"> in index.html
const TEMPLATE_FALLBACKS = {
  searchResults: `
    {{#books}}
    <article class="book-card {{#isSelected}}is-selected{{/isSelected}}" tabindex="0" role="button" aria-label="Book: {{title}}" data-key="{{key}}">
      <div class="card-cover-wrap">
        {{#hasCover}}
        <img 
          src="{{coverUrl}}" 
          alt="Cover for {{title}}" 
          class="card-cover-img" 
          loading="lazy"
          data-title="{{title}}"
          data-author="{{author}}"
          onerror="handleCoverImageError(this);"
        />
        {{/hasCover}}
        {{^hasCover}}
        {{{placeholderHtml}}}
        {{/hasCover}}
      </div>
      <div class="card-body">
        <h3 class="card-title" title="{{title}}">{{title}}</h3>
        <p class="card-author">{{author}}</p>
        <div class="card-meta-line">
          <span>{{year}}</span>
          {{#editions}}
          <span>•</span><span>{{editions}}</span>
          {{/editions}}
        </div>
        {{#hasSubjects}}
        <div class="card-subjects">
          {{#subjects}}
          <span class="subject-badge">{{name}}</span>
          {{/subjects}}
        </div>
        {{/hasSubjects}}
        <div class="card-footer">
          <button type="button" class="btn-details" aria-label="View details for {{title}}">
            <span>View Details</span> &rarr;
          </button>
        </div>
      </div>
    </article>
    {{/books}}
  `,

  searchCard: `
    <div class="card-cover-wrap">
      {{#hasCover}}
      <img 
        src="{{coverUrl}}" 
        alt="Cover for {{title}}" 
        class="card-cover-img" 
        loading="lazy"
        data-title="{{title}}"
        data-author="{{author}}"
        onerror="handleCoverImageError(this);"
      />
      {{/hasCover}}
      {{^hasCover}}
      {{{placeholderHtml}}}
      {{/hasCover}}
    </div>
    <div class="card-body">
      <h3 class="card-title" title="{{title}}">{{title}}</h3>
      <p class="card-author">{{author}}</p>
      <div class="card-meta-line">
        <span>{{year}}</span>
        {{#editions}}
        <span>•</span><span>{{editions}}</span>
        {{/editions}}
      </div>
      {{#hasSubjects}}
      <div class="card-subjects">
        {{#subjects}}
        <span class="subject-badge">{{name}}</span>
        {{/subjects}}
      </div>
      {{/hasSubjects}}
      <div class="card-footer">
        <button type="button" class="btn-details" aria-label="View details for {{title}}">
          <span>View Details</span> &rarr;
        </button>
      </div>
    </div>
  `,

  collectionBooks: `
    {{#books}}
    <article class="predefined-card {{#isSelected}}is-selected{{/isSelected}}" tabindex="0" role="button" aria-label="Art Book: {{title}}" data-key="{{key}}">
      <div class="predefined-cover-wrap">
        {{#hasCover}}
        <img 
          src="{{coverUrl}}" 
          alt="Cover for {{title}}" 
          class="predefined-cover-img" 
          loading="lazy"
          data-title="{{title}}"
          data-author="{{author}}"
          onerror="handleCoverImageError(this);"
        />
        {{/hasCover}}
        {{^hasCover}}
        {{{placeholderHtml}}}
        {{/hasCover}}
      </div>
      <div class="predefined-card-body">
        <h4 class="predefined-title" title="{{title}}">{{title}}</h4>
        <p class="predefined-author">{{author}}</p>
        {{#yearText}}
        <span class="predefined-year">First published: {{yearText}}</span>
        {{/yearText}}
        <div class="predefined-card-footer">
          <button type="button" class="btn-details" aria-label="View details for {{title}}">
            <span>View Details</span> &rarr;
          </button>
        </div>
      </div>
    </article>
    {{/books}}
  `,

  collectionCard: `
    <div class="predefined-cover-wrap">
      {{#hasCover}}
      <img 
        src="{{coverUrl}}" 
        alt="Cover for {{title}}" 
        class="predefined-cover-img" 
        loading="lazy"
        data-title="{{title}}"
        data-author="{{author}}"
        onerror="handleCoverImageError(this);"
      />
      {{/hasCover}}
      {{^hasCover}}
      {{{placeholderHtml}}}
      {{/hasCover}}
    </div>
    <div class="predefined-card-body">
      <h4 class="predefined-title" title="{{title}}">{{title}}</h4>
      <p class="predefined-author">{{author}}</p>
      {{#yearText}}
      <span class="predefined-year">First published: {{yearText}}</span>
      {{/yearText}}
      <div class="predefined-card-footer">
        <button type="button" class="btn-details" aria-label="View details for {{title}}">
          <span>View Details</span> &rarr;
        </button>
      </div>
    </div>
  `,

  bookDetails: `
    <div class="details-cover-col">
      <div class="details-cover-frame">
        {{#hasCover}}
        <img 
          src="{{coverUrl}}" 
          alt="Cover of {{title}}" 
          class="details-cover-img"
          data-title="{{title}}"
          data-author="{{author}}"
          onerror="handleCoverImageError(this);"
        />
        {{/hasCover}}
        {{^hasCover}}
        {{{placeholderHtml}}}
        {{/hasCover}}
      </div>
      <div class="details-external-links">
        <a href="{{workUrl}}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="width: 100%; text-decoration: none;">
          <span>View on OpenLibrary</span>
        </a>
      </div>
    </div>

    <div class="details-info-col">
      <div>
        <h3 id="modal-title-heading" class="details-title">{{title}}</h3>
        <p class="details-authors">By {{author}}</p>
      </div>

      <div class="metadata-grid">
        <div class="metadata-item">
          <span class="metadata-label">Work Number</span>
          <span class="metadata-value" title="{{rawWorkKey}}">{{workNumber}}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">First Published</span>
          <span class="metadata-value">{{firstYear}}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Editions Count</span>
          <span class="metadata-value">{{editions}}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Primary ISBN</span>
          <span class="metadata-value">{{isbn}}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Publishers</span>
          <span class="metadata-value">{{publisher}}</span>
        </div>
        <div class="metadata-item">
          <span class="metadata-label">Languages</span>
          <span class="metadata-value">{{languages}}</span>
        </div>
      </div>

      <div class="details-description-box">
        <h4 class="description-title">Description</h4>
        <p class="description-text">{{description}}</p>
      </div>

      {{#hasSubjects}}
      <div class="details-subjects-box">
        <h4 class="subjects-title">Subjects (Click to search)</h4>
        <div class="subjects-list">
          {{#subjects}}
          <button type="button" class="subject-pill" data-subject="{{name}}">{{name}}</button>
          {{/subjects}}
        </div>
      </div>
      {{/hasSubjects}}
    </div>
  `,

  coverPlaceholder: `
    <div class="cover-placeholder">
      <span class="cover-placeholder-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
      </span>
      <span class="cover-placeholder-title">{{title}}</span>
      {{#hasAuthor}}
      <span class="cover-placeholder-author">{{author}}</span>
      {{/hasAuthor}}
      <span class="cover-placeholder-badge">No Cover Available</span>
    </div>
  `,

  noMatches: `
    <div class="state-message no-match-state">
      <div class="state-icon">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
      </div>
      <h3>No Books Found</h3>
      <p class="no-match-subtitle">We couldn't find any books matching "<strong>{{query}}</strong>" searching by {{searchTypeLabel}}.</p>
      <div class="no-match-suggestions">
        <h4>Search Tips &amp; Suggestions:</h4>
        <ul>
          <li>Double-check for any typos or misspellings in your search.</li>
          <li>Try searching by <strong>{{alternativeTypeLabel}}</strong> instead of {{searchTypeLabel}}.</li>
          <li>Use fewer, broader, or more common keywords.</li>
          <li>Browse our handpicked <strong>Predefined Book Collection</strong> below.</li>
        </ul>
      </div>
      <button type="button" id="btn-clear-no-match" class="btn btn-secondary btn-sm">Clear Search</button>
    </div>
  `
};

const TEMPLATES = {
  get(id, fallback) {
    if (typeof document !== 'undefined') {
      const el = document.getElementById(id);
      if (el && el.innerHTML && el.innerHTML.trim()) {
        return el.innerHTML.trim();
      }
    }
    return (fallback || '').trim();
  }
};

// ==========================================================================
// 3. Application State Management
// ==========================================================================
const appState = {
  // Search parameters
  query: '',
  searchType: 'q', // 'q' (keywords/any) or 'title'
  limit: 10,       // 10, 25, 50 (divisible into 50 results cap)
  currentPage: 1,

  // Results pool (up to the first 50 results)
  allAvailableResults: [], // Cached pool of up to 50 items
  totalCatalogMatches: 0,  // Total matches reported by catalog (e.g. 15,400)
  accessibleCount: 0,      // Number of accessible items (<= 50)
  totalPages: 1,

  isLoading: false,
  hasSearched: false,

  // Results view mode: 'grid' or 'list'
  viewMode: 'grid',

  // Currently selected book details
  selectedBook: null,

  // Predefined Art collection
  artCollection: [],
  isCollectionLoading: false,
  collectionViewMode: 'grid'
};

// ==========================================================================
// 3. DOM Elements Cache
// ==========================================================================
const DOM = {
  // Search Form
  searchForm: document.getElementById('search-form'),
  searchInput: document.getElementById('search-input'),
  searchInputError: document.getElementById('search-input-error'),
  searchType: document.getElementById('search-type'),
  searchLimit: document.getElementById('search-limit'),
  btnClearQuery: document.getElementById('btn-clear-query'),
  btnResetForm: document.getElementById('btn-reset-form'),

  // Results Section
  resultsContainer: document.getElementById('results-container'),
  resultsItems: document.getElementById('results-items'),
  resultsEmptyState: document.getElementById('results-empty-state'),
  resultsLoadingState: document.getElementById('results-loading-state'),
  resultsErrorState: document.getElementById('results-error-state'),
  resultsCountText: document.getElementById('results-count-text'),
  btnViewGrid: document.getElementById('btn-view-grid'),
  btnViewList: document.getElementById('btn-view-list'),
  btnRetrySearch: document.getElementById('btn-retry-search'),
  statusIndicator: document.querySelector('.status-indicator'),

  // Pagination Section
  paginationMetaCurrent: document.getElementById('pagination-current-page-info'),
  paginationItemsRange: document.getElementById('pagination-items-range'),
  btnPageFirst: document.getElementById('btn-page-first'),
  btnPagePrev: document.getElementById('btn-page-prev'),
  btnPageNext: document.getElementById('btn-page-next'),
  btnPageLast: document.getElementById('btn-page-last'),
  paginationNumberButtons: document.getElementById('pagination-number-buttons'),

  // Book Details Modal
  bookModal: document.getElementById('book-details-modal'),
  modalBackdrop: document.getElementById('modal-backdrop'),
  btnModalClose: document.getElementById('btn-modal-close'),
  modalLoading: document.getElementById('modal-loading'),
  modalContent: document.getElementById('modal-content'),
  navBtnModal: document.getElementById('nav-btn-modal'),

  // Predefined Collection Section
  predefinedGrid: document.getElementById('predefined-collection-grid'),
  collectionCountText: document.getElementById('collection-count-text'),
  btnReloadCollection: document.getElementById('btn-reload-collection'),
  btnCollectionViewGrid: document.getElementById('btn-collection-view-grid'),
  btnCollectionViewList: document.getElementById('btn-collection-view-list')
};

// ==========================================================================
// 5. Section 1: Search Logic, Input Validation & Handlers
// ==========================================================================
function initSearchEvents() {
  // Form submission: reads and validates search input
  DOM.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const rawQuery = DOM.searchInput.value;
    if (!validateSearchInput(rawQuery)) {
      return;
    }
    appState.query = rawQuery.trim();
    appState.searchType = DOM.searchType.value;
    appState.limit = parseInt(DOM.searchLimit.value, 10) || 10;
    appState.currentPage = 1;
    executeSearch();
  });

  // Real-time input handling & validation clearing
  DOM.searchInput.addEventListener('input', () => {
    const val = DOM.searchInput.value.trim();
    if (val.length > 0) {
      DOM.btnClearQuery.style.display = 'block';
    } else {
      DOM.btnClearQuery.style.display = 'none';
    }
    if (val.length >= 2) {
      clearValidationError();
    }
  });

  // Per page limit selector: dynamically re-chunks results
  DOM.searchLimit.addEventListener('change', () => {
    appState.limit = parseInt(DOM.searchLimit.value, 10) || 10;
    if (appState.hasSearched && appState.accessibleCount > 0) {
      appState.totalPages = Math.max(1, Math.ceil(appState.accessibleCount / appState.limit));
      appState.currentPage = 1;
      renderCurrentPageResults();
      updatePaginationUI();
    }
  });

  // Search type selector change
  DOM.searchType.addEventListener('change', () => {
    appState.searchType = DOM.searchType.value;
    if (appState.hasSearched && appState.query) {
      appState.currentPage = 1;
      executeSearch();
    }
  });

  // Clear query button: clears query and resets active search
  DOM.btnClearQuery.addEventListener('click', () => {
    resetSearch();
    DOM.searchInput.focus();
  });

  // Reset form button: completely resets search, results, and details states
  DOM.btnResetForm.addEventListener('click', () => {
    resetSearch();
  });

  // Retry search button in error state
  DOM.btnRetrySearch.addEventListener('click', () => {
    if (appState.query) {
      executeSearch();
    }
  });
}

function validateSearchInput(input) {
  if (!input || input.trim().length === 0) {
    showValidationError('Please enter a book title or keywords to search.');
    return false;
  }
  if (input.trim().length < 2) {
    showValidationError('Search query must be at least 2 characters long.');
    return false;
  }
  clearValidationError();
  return true;
}

function showValidationError(message) {
  if (DOM.searchInputError) {
    DOM.searchInputError.textContent = message;
    DOM.searchInputError.style.display = 'flex';
  }
  DOM.searchInput.classList.add('input-invalid');
  DOM.searchInput.focus();
}

function clearValidationError() {
  if (DOM.searchInputError) {
    DOM.searchInputError.textContent = '';
    DOM.searchInputError.style.display = 'none';
  }
  DOM.searchInput.classList.remove('input-invalid');
}

function resetSearch() {
  clearValidationError();
  DOM.searchForm.reset();
  DOM.searchInput.value = '';
  DOM.btnClearQuery.style.display = 'none';
  appState.query = '';
  appState.currentPage = 1;
  appState.totalCatalogMatches = 0;
  appState.allAvailableResults = [];
  appState.accessibleCount = 0;
  appState.totalPages = 1;
  appState.hasSearched = false;
  appState.selectedBook = null;

  // Hide "View Book Details" navbar button
  if (DOM.navBtnModal) {
    DOM.navBtnModal.style.display = 'none';
    DOM.navBtnModal.removeAttribute('title');
  }

  // Remove selection highlight from any cards
  document.querySelectorAll('.book-card, .predefined-card').forEach(el => el.classList.remove('is-selected'));

  // Close details modal if open
  closeBookModal();

  renderEmptyState();
  updatePaginationUI();
}

// ==========================================================================
// 6. Core jQuery AJAX Search Execution (Up to 50 results)
// ==========================================================================
function executeSearch() {
  if (!appState.query) return;

  appState.isLoading = true;
  appState.hasSearched = true;

  // Update UI indicators
  setSearchLoadingState(true);

  // Retrieve up to the first 50 available results from Open Library
  const requestData = {
    limit: 50
  };

  if (appState.searchType === 'title') {
    requestData.title = appState.query;
  } else {
    requestData.q = appState.query;
  }

  // Pure jQuery AJAX call to Open Library Search API
  $.ajax({
    url: 'https://openlibrary.org/search.json',
    method: 'GET',
    data: requestData,
    dataType: 'json',
    timeout: 15000,
    success: function (response) {
      appState.isLoading = false;
      setSearchLoadingState(false);

      if (!response || !response.docs) {
        renderErrorState('Invalid response received from Open Library API.');
        return;
      }

      const docs = Array.isArray(response.docs) ? response.docs : [];
      appState.totalCatalogMatches = response.numFound || docs.length;

      // Make up to the first 50 available results accessible through pagination
      appState.allAvailableResults = docs.slice(0, 50);
      appState.accessibleCount = appState.allAvailableResults.length;

      // Show meaningful message when no books match
      if (appState.accessibleCount === 0) {
        renderNoMatchState(appState.query);
        return;
      }

      // Display fewer results when fewer than 50 are available
      appState.totalPages = Math.max(1, Math.ceil(appState.accessibleCount / appState.limit));
      appState.currentPage = 1;

      renderCurrentPageResults();
      updatePaginationUI();

      // Smoothly bring results into view
      DOM.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },
    error: function (xhr, status, error) {
      appState.isLoading = false;
      setSearchLoadingState(false);
      console.error('Open Library AJAX error:', status, error, xhr);
      renderErrorState(`Unable to fetch books from Open Library (${error || status || 'Network Error'}).`);
    }
  });
}

function setSearchLoadingState(loading) {
  if (loading) {
    DOM.resultsLoadingState.style.display = 'flex';
    DOM.resultsEmptyState.style.display = 'none';
    DOM.resultsErrorState.style.display = 'none';
    DOM.resultsItems.style.display = 'none';
    DOM.statusIndicator.className = 'status-indicator loading';
    DOM.resultsCountText.innerHTML = `Searching for <strong>"${escapeHTML(appState.query)}"</strong>...`;
  } else {
    DOM.resultsLoadingState.style.display = 'none';
  }
}

function renderEmptyState() {
  DOM.resultsEmptyState.style.display = 'flex';
  DOM.resultsLoadingState.style.display = 'none';
  DOM.resultsErrorState.style.display = 'none';
  DOM.resultsItems.style.display = 'none';
  DOM.resultsItems.innerHTML = '';
  DOM.statusIndicator.className = 'status-indicator';
  DOM.resultsCountText.textContent = 'No active search. Enter a book title or keywords above.';
  if (DOM.navBtnModal) {
    DOM.navBtnModal.style.display = 'none';
  }
}

function renderErrorState(customMessage) {
  DOM.resultsErrorState.style.display = 'flex';
  DOM.resultsEmptyState.style.display = 'none';
  DOM.resultsLoadingState.style.display = 'none';
  DOM.resultsItems.style.display = 'none';
  DOM.statusIndicator.className = 'status-indicator';
  if (customMessage) {
    document.getElementById('error-message').textContent = customMessage;
  }
  DOM.resultsCountText.innerHTML = `<span style="color:var(--danger)">Search encountered an error.</span>`;
}

function renderNoMatchState(query) {
  DOM.resultsEmptyState.style.display = 'none';
  DOM.resultsLoadingState.style.display = 'none';
  DOM.resultsErrorState.style.display = 'none';
  DOM.resultsItems.style.display = 'block';
  DOM.resultsItems.innerHTML = '';
  DOM.statusIndicator.className = 'status-indicator';
  DOM.resultsCountText.innerHTML = `Found <strong>0</strong> books matching "<strong>${escapeHTML(query)}</strong>"`;

  // Hide modal shortcut and reset selection if no matches
  appState.selectedBook = null;
  if (DOM.navBtnModal) {
    DOM.navBtnModal.style.display = 'none';
    DOM.navBtnModal.removeAttribute('title');
  }
  document.querySelectorAll('.book-card, .predefined-card').forEach(el => el.classList.remove('is-selected'));

  const searchTypeLabel = appState.searchType === 'title' ? 'Book Title' : 'Keywords';
  const alternativeTypeLabel = appState.searchType === 'title' ? 'Keywords' : 'Book Title';

  const template = TEMPLATES.get('tmpl-no-matches', TEMPLATE_FALLBACKS.noMatches);
  const data = {
    query: query,
    searchTypeLabel: searchTypeLabel,
    alternativeTypeLabel: alternativeTypeLabel
  };

  const renderedHtml = Mustache.render(template, data);

  const noMatchCard = document.createElement('div');
  noMatchCard.className = 'state-message no-match-state';
  noMatchCard.innerHTML = renderedHtml;
  DOM.resultsItems.appendChild(noMatchCard);

  const btnClear = noMatchCard.querySelector('#btn-clear-no-match');
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      resetSearch();
      DOM.searchInput.focus();
    });
  }

  updatePaginationUI();
}

// ==========================================================================
// 7. Cover Image Helpers & Fallbacks
// ==========================================================================
function getCoverPlaceholderHTML(title, author = '') {
  const safeTitle = title || 'Untitled Book';
  const safeAuthor = author || '';
  const data = {
    title: safeTitle,
    author: safeAuthor,
    hasAuthor: !!safeAuthor
  };
  const template = TEMPLATES.get('tmpl-cover-placeholder', TEMPLATE_FALLBACKS.coverPlaceholder);
  return Mustache.render(template, data);
}

// Global cover error handler for broken or 404 image URLs
window.handleCoverImageError = function (img) {
  if (!img) return;
  img.onerror = null;
  const parent = img.parentElement;
  if (!parent) return;
  const title = img.getAttribute('data-title') || 'Untitled Book';
  const author = img.getAttribute('data-author') || '';
  parent.innerHTML = getCoverPlaceholderHTML(title, author);
};

// ==========================================================================
// 8. Section 2: Search Results Rendering & View Switcher
// ==========================================================================
function initViewSwitcher() {
  DOM.btnViewGrid.addEventListener('click', () => {
    setViewMode('grid');
  });

  DOM.btnViewList.addEventListener('click', () => {
    setViewMode('list');
  });
}

function setViewMode(mode) {
  appState.viewMode = mode;
  if (mode === 'grid') {
    DOM.resultsContainer.classList.remove('list-view');
    DOM.resultsContainer.classList.add('grid-view');
    DOM.btnViewGrid.classList.add('active');
    DOM.btnViewGrid.setAttribute('aria-pressed', 'true');
    DOM.btnViewList.classList.remove('active');
    DOM.btnViewList.setAttribute('aria-pressed', 'false');
  } else {
    DOM.resultsContainer.classList.remove('grid-view');
    DOM.resultsContainer.classList.add('list-view');
    DOM.btnViewList.classList.add('active');
    DOM.btnViewList.setAttribute('aria-pressed', 'true');
    DOM.btnViewGrid.classList.remove('active');
    DOM.btnViewGrid.setAttribute('aria-pressed', 'false');
  }
}

function prepareBookViewModel(book, index) {
  const rawTitle = book.title || 'Untitled Book';
  const rawAuthor = book.author_name
    ? (Array.isArray(book.author_name) ? book.author_name.slice(0, 2).join(', ') : book.author_name)
    : 'Unknown Author';
  const coverId = book.cover_i ? Number(book.cover_i) : 0;
  const hasCover = coverId > 0;
  const coverUrl = hasCover ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : '';
  const placeholderHtml = hasCover ? '' : getCoverPlaceholderHTML(rawTitle, rawAuthor);
  const year = book.first_publish_year ? `First published: ${book.first_publish_year}` : 'Publish year unavailable';
  const editions = book.edition_count ? `${book.edition_count} ${book.edition_count === 1 ? 'edition' : 'editions'}` : '';

  let subjects = [];
  if (book.subject && Array.isArray(book.subject)) {
    subjects = book.subject.slice(0, 3).map(s => ({ name: s }));
  }

  const isSelected = !!(appState.selectedBook && appState.selectedBook.key === book.key);

  return {
    key: book.key || '',
    index: index,
    title: rawTitle,
    author: rawAuthor,
    hasCover: hasCover,
    coverUrl: coverUrl,
    placeholderHtml: placeholderHtml,
    year: year,
    editions: editions,
    hasSubjects: subjects.length > 0,
    subjects: subjects,
    isSelected: isSelected
  };
}

function renderCurrentPageResults() {
  if (appState.accessibleCount === 0) {
    renderNoMatchState(appState.query);
    return;
  }

  DOM.resultsEmptyState.style.display = 'none';
  DOM.resultsErrorState.style.display = 'none';
  DOM.resultsItems.style.display = appState.viewMode === 'grid' ? 'grid' : 'flex';
  DOM.statusIndicator.className = 'status-indicator active';

  const startIndex = (appState.currentPage - 1) * appState.limit;
  const endIndex = Math.min(startIndex + appState.limit, appState.accessibleCount);
  const pageItems = appState.allAvailableResults.slice(startIndex, endIndex);

  const searchTypeLabel = appState.searchType === 'title' ? 'title' : 'keywords';

  if (appState.totalCatalogMatches > 50) {
    DOM.resultsCountText.innerHTML = `Showing <strong>${appState.accessibleCount}</strong> accessible results (of ${appState.totalCatalogMatches.toLocaleString()} catalog matches) for "<strong>${escapeHTML(appState.query)}</strong>" by ${searchTypeLabel} • Page ${appState.currentPage} of ${appState.totalPages}`;
  } else {
    DOM.resultsCountText.innerHTML = `Found <strong>${appState.accessibleCount}</strong> ${appState.accessibleCount === 1 ? 'book' : 'books'} for "<strong>${escapeHTML(appState.query)}</strong>" by ${searchTypeLabel} • Page ${appState.currentPage} of ${appState.totalPages}`;
  }

  // Render items using Mustache.js template
  DOM.resultsItems.innerHTML = '';
  const booksData = pageItems.map((book, index) => prepareBookViewModel(book, startIndex + index));
  const listTemplate = TEMPLATES.get('tmpl-search-results', TEMPLATE_FALLBACKS.searchResults);
  DOM.resultsItems.innerHTML = Mustache.render(listTemplate, { books: booksData });

  // Attach interaction handlers (or create card nodes if running in mock DOM environment)
  const renderedCards = DOM.resultsItems.querySelectorAll('.book-card');
  if (renderedCards && renderedCards.length > 0) {
    renderedCards.forEach((card, idx) => {
      const book = pageItems[idx];
      if (book) {
        card.addEventListener('click', () => openBookModal(book, 'search'));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openBookModal(book, 'search');
          }
        });
      }
    });
  } else {
    // If mock DOM doesn't populate querySelectorAll from innerHTML, construct card nodes via Mustache
    pageItems.forEach((book, index) => {
      const card = createBookCardElement(book, startIndex + index);
      DOM.resultsItems.appendChild(card);
    });
  }
}

function createBookCardElement(book, index) {
  const viewModel = prepareBookViewModel(book, index);
  const card = document.createElement('article');
  card.className = `book-card ${viewModel.isSelected ? 'is-selected' : ''}`.trim();
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Book: ${viewModel.title}`);
  card.setAttribute('data-key', viewModel.key);

  const cardTemplate = TEMPLATES.get('tmpl-search-card', TEMPLATE_FALLBACKS.searchCard);
  card.innerHTML = Mustache.render(cardTemplate, viewModel);

  // Click card or details button to open details modal
  card.addEventListener('click', () => {
    openBookModal(book, 'search');
  });

  // Keyboard accessibility
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openBookModal(book, 'search');
    }
  });

  return card;
}

// ==========================================================================
// 9. Section 3: Pagination Controls & Handlers
// ==========================================================================
function initPaginationEvents() {
  if (DOM.btnPageFirst) {
    DOM.btnPageFirst.addEventListener('click', () => {
      if (appState.currentPage > 1) {
        goToPage(1);
      }
    });
  }

  if (DOM.btnPagePrev) {
    DOM.btnPagePrev.addEventListener('click', () => {
      if (appState.currentPage > 1) {
        goToPage(appState.currentPage - 1);
      }
    });
  }

  if (DOM.btnPageNext) {
    DOM.btnPageNext.addEventListener('click', () => {
      if (appState.currentPage < appState.totalPages) {
        goToPage(appState.currentPage + 1);
      }
    });
  }

  if (DOM.btnPageLast) {
    DOM.btnPageLast.addEventListener('click', () => {
      if (appState.currentPage < appState.totalPages) {
        goToPage(appState.totalPages);
      }
    });
  }
}

function goToPage(page) {
  if (appState.isLoading) return;
  if (page < 1 || page > appState.totalPages) return;
  if (page === appState.currentPage) return;
  appState.currentPage = page;
  renderCurrentPageResults();
  updatePaginationUI();
  if (DOM.resultsContainer) {
    DOM.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function updatePaginationUI() {
  const hasPages = !appState.isLoading && appState.hasSearched && appState.accessibleCount > 0;
  const current = appState.currentPage;
  const total = appState.totalPages;

  if (DOM.paginationMetaCurrent) {
    DOM.paginationMetaCurrent.innerHTML = `Page <strong>${current}</strong> of <strong>${total}</strong>`;
  }

  if (DOM.paginationItemsRange) {
    if (hasPages) {
      const startIndex = (current - 1) * appState.limit + 1;
      const endIndex = Math.min(startIndex + appState.limit - 1, appState.accessibleCount);
      if (appState.totalCatalogMatches > 50) {
        DOM.paginationItemsRange.textContent = `Showing ${startIndex} - ${endIndex} of ${appState.accessibleCount} accessible results (${appState.totalCatalogMatches.toLocaleString()} total in catalog)`;
      } else {
        DOM.paginationItemsRange.textContent = `Showing ${startIndex} - ${endIndex} of ${appState.accessibleCount} results`;
      }
    } else {
      DOM.paginationItemsRange.textContent = 'Showing 0 results';
    }
  }

  if (DOM.btnPageFirst) DOM.btnPageFirst.disabled = !hasPages || current <= 1;
  if (DOM.btnPagePrev) DOM.btnPagePrev.disabled = !hasPages || current <= 1;
  if (DOM.btnPageNext) DOM.btnPageNext.disabled = !hasPages || current >= total;
  if (DOM.btnPageLast) DOM.btnPageLast.disabled = !hasPages || current >= total;

  // Build Numbered Page Buttons
  if (DOM.paginationNumberButtons) {
    DOM.paginationNumberButtons.innerHTML = '';
    if (!hasPages) return;

    const maxButtons = 5;
    let startPage = Math.max(1, current - Math.floor(maxButtons / 2));
    let endPage = Math.min(total, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    // Preceding ellipsis if needed
    if (startPage > 1) {
      const btn1 = createPageNumButton(1, current);
      DOM.paginationNumberButtons.appendChild(btn1);
      if (startPage > 2) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        DOM.paginationNumberButtons.appendChild(ellipsis);
      }
    }

    // Page buttons
    for (let p = startPage; p <= endPage; p++) {
      const btn = createPageNumButton(p, current);
      DOM.paginationNumberButtons.appendChild(btn);
    }

    // Trailing ellipsis if needed
    if (endPage < total) {
      if (endPage < total - 1) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        DOM.paginationNumberButtons.appendChild(ellipsis);
      }
      const btnLast = createPageNumButton(total, current);
      DOM.paginationNumberButtons.appendChild(btnLast);
    }
  }
}

function createPageNumButton(pageNum, activePage) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-page';
  btn.textContent = pageNum;
  btn.setAttribute('aria-label', `Go to page ${pageNum}`);
  if (pageNum === activePage) {
    btn.classList.add('active');
    btn.setAttribute('aria-current', 'page');
  }
  btn.addEventListener('click', () => {
    goToPage(pageNum);
  });
  return btn;
}

// ==========================================================================
// 10. Selected-Book Details Modal Logic (Works API via jQuery AJAX)
// ==========================================================================
function initModalEvents() {
  // Close modal on 'X' button click
  if (DOM.btnCloseModal) {
    DOM.btnCloseModal.addEventListener('click', closeBookModal);
  }

  // Close modal on footer button click
  if (DOM.btnModalClose) {
    DOM.btnModalClose.addEventListener('click', closeBookModal);
  }

  // Close modal on backdrop click
  if (DOM.modalBackdrop) {
    DOM.modalBackdrop.addEventListener('click', closeBookModal);
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.bookModal && DOM.bookModal.classList.contains('is-open')) {
      closeBookModal();
    }
  });

  // Re-open modal from navbar if a book was previously selected
  if (DOM.navBtnModal) {
    DOM.navBtnModal.addEventListener('click', () => {
      if (appState.selectedBook) {
        openBookModal(appState.selectedBook);
      }
    });
  }
}

function openBookModal(book) {
  if (!book) return;
  appState.selectedBook = book;

  // Highlight card across search results and predefined grid
  document.querySelectorAll('.book-card, .predefined-card').forEach(el => el.classList.remove('is-selected'));

  // Update navbar shortcut
  if (DOM.navBtnModal) {
    DOM.navBtnModal.style.display = 'inline-block';
    DOM.navBtnModal.title = `View details for: ${book.title}`;
  }

  // Open modal dialog
  DOM.bookModal.style.display = 'flex';
  setTimeout(() => {
    DOM.bookModal.classList.add('is-open');
    DOM.bookModal.setAttribute('aria-hidden', 'false');
    if (DOM.btnModalClose) {
      DOM.btnModalClose.focus();
    }
  }, 10);
  document.body.style.overflow = 'hidden';

  // Show loading state inside modal
  DOM.modalLoading.style.display = 'flex';
  DOM.modalContent.style.display = 'none';

  // If book has a key (e.g. /works/OL...W), fetch in-depth work details via jQuery AJAX
  if (book.key) {
    const workEndpoint = `https://openlibrary.org${book.key}.json`;

    $.ajax({
      url: workEndpoint,
      method: 'GET',
      dataType: 'json',
      timeout: 10000,
      success: function (workData) {
        DOM.modalLoading.style.display = 'none';
        renderModalBookDetails(book, workData);
      },
      error: function (xhr, status, error) {
        console.warn('Could not fetch work details via AJAX, using cached book data.', status, error);
        DOM.modalLoading.style.display = 'none';
        renderModalBookDetails(book, null);
      }
    });
  } else {
    DOM.modalLoading.style.display = 'none';
    renderModalBookDetails(book, null);
  }
}

function renderModalBookDetails(book, workData) {
  DOM.modalContent.style.display = 'grid';

  const rawTitle = book.title || (workData && workData.title) || 'Untitled Work';
  const rawAuthor = book.author_name
    ? (Array.isArray(book.author_name) ? book.author_name.join(', ') : book.author_name)
    : (book.authors && book.authors.length > 0 ? (typeof book.authors[0] === 'string' ? book.authors[0] : book.authors[0].name) : 'Unknown Author');

  // Description extraction (Open Library formats: string OR { value: string })
  let description = 'No detailed synopsis is currently available in the Open Library catalog for this work.';
  if (workData && workData.description) {
    if (typeof workData.description === 'string') {
      description = workData.description;
    } else if (typeof workData.description === 'object' && workData.description.value) {
      description = workData.description.value;
    }
  } else if (book.description) {
    description = book.description;
  }

  // Cover image URL
  let coverId = null;
  if (book.cover_i) {
    coverId = Number(book.cover_i);
  } else if (workData && workData.covers && workData.covers.length > 0) {
    coverId = Number(workData.covers[0]);
  } else if (book.cover_id) {
    coverId = Number(book.cover_id);
  }

  const hasCover = !!(coverId && coverId > 0);
  const coverUrl = hasCover ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : '';
  const placeholderHtml = hasCover ? '' : getCoverPlaceholderHTML(rawTitle, rawAuthor);

  // Metadata attributes
  const rawWorkKey = (workData && workData.key) || book.key || '';
  const workNumber = rawWorkKey ? rawWorkKey.replace(/^\/works\//, '') : 'N/A';
  const firstYear = book.first_publish_year || (workData && workData.first_publish_date) || 'N/A';
  const editions = book.edition_count || '1+';
  const publisher = (book.publisher && book.publisher.length > 0) ? book.publisher.slice(0, 3).join(', ') : 'Various Publishers';
  const isbn = (book.isbn && book.isbn.length > 0) ? book.isbn[0] : 'N/A';
  const languages = (book.language && Array.isArray(book.language)) ? book.language.join(', ') : 'English / Multiple';

  // Subjects
  let subjectsList = [];
  if (workData && Array.isArray(workData.subjects) && workData.subjects.length > 0) {
    subjectsList = workData.subjects;
  } else if (book.subject && Array.isArray(book.subject)) {
    subjectsList = book.subject;
  } else if (book.subjects && Array.isArray(book.subjects)) {
    subjectsList = book.subjects;
  }

  const subjects = subjectsList.slice(0, 10).map(s => {
    const sName = typeof s === 'string' ? s : (s.name || '');
    return { name: sName };
  }).filter(s => s.name);

  // Work key url
  const workUrl = book.key ? `https://openlibrary.org${book.key}` : 'https://openlibrary.org';

  const viewModel = {
    title: rawTitle,
    author: rawAuthor,
    description: description,
    hasCover: hasCover,
    coverUrl: coverUrl,
    placeholderHtml: placeholderHtml,
    rawWorkKey: rawWorkKey,
    workNumber: workNumber,
    firstYear: firstYear,
    editions: editions,
    publisher: publisher,
    isbn: isbn,
    languages: languages,
    hasSubjects: subjects.length > 0,
    subjects: subjects,
    workUrl: workUrl
  };

  const template = TEMPLATES.get('tmpl-book-details', TEMPLATE_FALLBACKS.bookDetails);
  DOM.modalContent.innerHTML = Mustache.render(template, viewModel);

  // Attach search events to subject pills inside modal
  DOM.modalContent.querySelectorAll('.subject-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      const subjectName = pill.getAttribute('data-subject');
      closeBookModal();
      DOM.searchInput.value = subjectName;
      DOM.searchType.value = 'q';
      DOM.btnClearQuery.style.display = 'block';
      clearValidationError();
      handleSearchSubmit();
      DOM.searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
}

function closeBookModal() {
  if (!DOM.bookModal) return;
  DOM.bookModal.classList.remove('is-open');
  DOM.bookModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';

  // Remove/hide the "View Book Details" button when modal is closed
  if (DOM.navBtnModal) {
    DOM.navBtnModal.style.display = 'none';
    DOM.navBtnModal.removeAttribute('title');
  }

  // Remove active selection highlight from cards
  document.querySelectorAll('.book-card, .predefined-card').forEach(el => el.classList.remove('is-selected'));
  appState.selectedBook = null;

  setTimeout(() => {
    DOM.bookModal.style.display = 'none';
  }, 220);
}

// ==========================================================================
// 11. Section 5: Predefined "Art" Subject Book Collection
// ==========================================================================
function initPredefinedCollection() {
  if (DOM.btnReloadCollection) {
    DOM.btnReloadCollection.addEventListener('click', () => {
      fetchArtCollection();
    });
  }

  if (DOM.btnCollectionViewGrid) {
    DOM.btnCollectionViewGrid.addEventListener('click', () => {
      setCollectionViewMode('grid');
    });
  }

  if (DOM.btnCollectionViewList) {
    DOM.btnCollectionViewList.addEventListener('click', () => {
      setCollectionViewMode('list');
    });
  }

  // Initial dynamic fetch via jQuery AJAX
  fetchArtCollection();
}

function setCollectionViewMode(mode) {
  appState.collectionViewMode = mode;
  if (!DOM.predefinedGrid) return;

  if (mode === 'grid') {
    DOM.predefinedGrid.classList.remove('list-view');
    DOM.predefinedGrid.classList.add('grid-view');
    if (DOM.btnCollectionViewGrid) {
      DOM.btnCollectionViewGrid.classList.add('active');
      DOM.btnCollectionViewGrid.setAttribute('aria-pressed', 'true');
    }
    if (DOM.btnCollectionViewList) {
      DOM.btnCollectionViewList.classList.remove('active');
      DOM.btnCollectionViewList.setAttribute('aria-pressed', 'false');
    }
  } else {
    DOM.predefinedGrid.classList.remove('grid-view');
    DOM.predefinedGrid.classList.add('list-view');
    if (DOM.btnCollectionViewList) {
      DOM.btnCollectionViewList.classList.add('active');
      DOM.btnCollectionViewList.setAttribute('aria-pressed', 'true');
    }
    if (DOM.btnCollectionViewGrid) {
      DOM.btnCollectionViewGrid.classList.remove('active');
      DOM.btnCollectionViewGrid.setAttribute('aria-pressed', 'false');
    }
  }
}

function normalizeSubjectWork(work) {
  const authorNames = (work.authors && Array.isArray(work.authors))
    ? work.authors.map(a => typeof a === 'string' ? a : (a.name || 'Unknown Author'))
    : (work.author_name ? (Array.isArray(work.author_name) ? work.author_name : [work.author_name]) : ['Unknown Author']);

  const coverId = work.cover_id || work.cover_i || (work.covers && work.covers[0]) || null;

  return {
    key: work.key,
    title: work.title || 'Untitled Work',
    author_name: authorNames,
    authors: work.authors,
    cover_i: coverId ? Number(coverId) : null,
    cover_id: coverId ? Number(coverId) : null,
    first_publish_year: work.first_publish_year || null,
    edition_count: work.edition_count || null,
    subject: work.subject || ['Art']
  };
}

function fetchArtCollection() {
  appState.isCollectionLoading = true;
  renderCollectionLoadingState();

  // Retrieve the collection dynamically using jQuery AJAX
  $.ajax({
    url: 'https://openlibrary.org/subjects/art.json',
    method: 'GET',
    data: {
      limit: 10
    },
    dataType: 'json',
    timeout: 10000,
    success: function (response) {
      appState.isCollectionLoading = false;
      const rawWorks = (response && Array.isArray(response.works)) ? response.works : [];

      // Display up to 10 books, depending on availability
      const works = rawWorks.slice(0, 10);

      if (works.length === 0) {
        renderCollectionEmptyState();
        return;
      }

      appState.artCollection = works.map(normalizeSubjectWork);
      renderArtCollection(appState.artCollection);
    },
    error: function (xhr, status, error) {
      appState.isCollectionLoading = false;
      console.error('Could not fetch Art subject collection from Open Library:', status, error);
      renderCollectionErrorState(`Unable to load Art collection from Open Library (${error || status || 'Network Error'}).`);
    }
  });
}

function renderCollectionLoadingState() {
  if (DOM.collectionCountText) {
    DOM.collectionCountText.innerHTML = `Loading...`;
  }
  DOM.predefinedGrid.innerHTML = `
    <div class="state-message" style="grid-column: 1 / -1; padding: 2.5rem 1rem;">
      <div class="spinner"></div>
      <p style="margin-top: 0.75rem; color: var(--text-muted);">Fetching books for "Art" subject from Open Library...</p>
    </div>
  `;
}

function renderCollectionEmptyState() {
  if (DOM.collectionCountText) {
    DOM.collectionCountText.textContent = `No books currently available for subject "Art".`;
  }
  DOM.predefinedGrid.innerHTML = `
    <div class="state-message" style="grid-column: 1 / -1; padding: 2.5rem 1rem;">
      <div class="state-icon">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
      </div>
      <h3>No Art Books Found</h3>
      <p>No books are currently listed under the "Art" subject in Open Library.</p>
    </div>
  `;
}

function renderCollectionErrorState(message) {
  if (DOM.collectionCountText) {
    DOM.collectionCountText.innerHTML = `<span style="color:var(--danger)">Failed to load Art collection</span>`;
  }
  DOM.predefinedGrid.innerHTML = `
    <div class="state-message" style="grid-column: 1 / -1; padding: 2.5rem 1rem;">
      <div class="state-icon">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </div>
      <h3>Collection Unavailable</h3>
      <p style="color: var(--danger);">${escapeHTML(message)}</p>
      <button type="button" id="btn-retry-collection" class="btn btn-secondary btn-sm" style="margin-top: 0.5rem;">
        Retry Loading
      </button>
    </div>
  `;
  const btnRetry = DOM.predefinedGrid.querySelector('#btn-retry-collection');
  if (btnRetry) {
    btnRetry.addEventListener('click', fetchArtCollection);
  }
}

function prepareArtBookViewModel(book) {
  const rawTitle = book.title || 'Untitled Book';
  const rawAuthor = (book.author_name && book.author_name.length > 0)
    ? book.author_name[0]
    : (book.authors && book.authors.length > 0 ? (typeof book.authors[0] === 'string' ? book.authors[0] : book.authors[0].name) : 'Unknown Author');
  const coverId = book.cover_i ? Number(book.cover_i) : (book.cover_id ? Number(book.cover_id) : 0);
  const hasCover = coverId > 0;
  const coverUrl = hasCover ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : '';
  const placeholderHtml = hasCover ? '' : getCoverPlaceholderHTML(rawTitle, rawAuthor);
  const yearText = book.first_publish_year ? String(book.first_publish_year) : '';
  const isSelected = !!(appState.selectedBook && appState.selectedBook.key === book.key);

  return {
    key: book.key || '',
    title: rawTitle,
    author: rawAuthor,
    hasCover: hasCover,
    coverUrl: coverUrl,
    placeholderHtml: placeholderHtml,
    yearText: yearText,
    isSelected: isSelected
  };
}

function renderArtCollection(books) {
  DOM.predefinedGrid.innerHTML = '';

  if (DOM.collectionCountText) {
    DOM.collectionCountText.innerHTML = `Displaying <strong>${books.length}</strong> ${books.length === 1 ? 'book' : 'books'} from Open Library "Art" subject`;
  }

  const booksData = books.map(book => prepareArtBookViewModel(book));
  const collectionTemplate = TEMPLATES.get('tmpl-collection-books', TEMPLATE_FALLBACKS.collectionBooks);
  DOM.predefinedGrid.innerHTML = Mustache.render(collectionTemplate, { books: booksData });

  // Attach card interaction events (click and keyboard navigation)
  const renderedCards = DOM.predefinedGrid.querySelectorAll('.predefined-card');
  if (renderedCards && renderedCards.length > 0) {
    renderedCards.forEach((card, idx) => {
      const book = books[idx];
      if (book) {
        card.addEventListener('click', () => {
          openBookModal(book, 'collection');
        });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openBookModal(book, 'collection');
          }
        });
      }
    });
  } else {
    // If mock DOM doesn't populate querySelectorAll from innerHTML, construct card nodes via Mustache
    books.forEach((book, idx) => {
      const card = createArtBookCardElement(book, booksData[idx]);
      DOM.predefinedGrid.appendChild(card);
    });
  }
}

function createArtBookCardElement(book, viewModel) {
  if (!viewModel) viewModel = prepareArtBookViewModel(book);
  const card = document.createElement('article');
  card.className = `predefined-card ${viewModel.isSelected ? 'is-selected' : ''}`.trim();
  card.setAttribute('tabindex', '0');
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', `Art Book: ${viewModel.title}`);
  card.setAttribute('data-key', viewModel.key);

  const cardTemplate = TEMPLATES.get('tmpl-collection-card', TEMPLATE_FALLBACKS.collectionCard);
  card.innerHTML = Mustache.render(cardTemplate, viewModel);

  card.addEventListener('click', () => {
    openBookModal(book, 'collection');
  });

  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openBookModal(book, 'collection');
    }
  });

  return card;
}

// ==========================================================================
// 12. Utility Helper Functions
// ==========================================================================
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================================
// 13. Application Initialization
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  try { initSearchEvents(); } catch (err) { console.error('Error initializing search events:', err); }
  try { initViewSwitcher(); } catch (err) { console.error('Error initializing view switcher:', err); }
  try { initPaginationEvents(); } catch (err) { console.error('Error initializing pagination events:', err); }
  try { initModalEvents(); } catch (err) { console.error('Error initializing modal events:', err); }
  try { initPredefinedCollection(); } catch (err) { console.error('Error initializing predefined collection:', err); }
  try { updatePaginationUI(); } catch (err) { console.error('Error updating pagination UI:', err); }
});
