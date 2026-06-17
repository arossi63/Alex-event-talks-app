// State Management
const state = {
    rawReleases: [],      // Raw entries as returned by API
    flatUpdates: [],      // Flat list of individual updates (extracted from entries)
    activeFilter: 'all',  // Current type filter: 'all', 'Feature', 'Announcement', etc.
    searchQuery: '',      // Current search string
    sortBy: 'desc',       // 'desc' (newest first), 'asc' (oldest first)
    viewMode: 'grouped',  // 'grouped' or 'feed'
    collapsedGroups: {},  // Map of date-strings to collapse boolean state
};

// UI Elements
const els = {
    btnRefresh: document.getElementById('btn-refresh'),
    syncTimeLabel: document.getElementById('sync-time-label'),
    syncDot: document.querySelector('.status-indicator-dot'),
    
    // Metrics
    metricAll: document.getElementById('metric-all'),
    metricFeatures: document.getElementById('metric-features'),
    metricAnnouncements: document.getElementById('metric-announcements'),
    metricIssues: document.getElementById('metric-issues'),
    metricDeprecations: document.getElementById('metric-deprecations'),
    
    valTotal: document.getElementById('val-total'),
    valFeatures: document.getElementById('val-features'),
    valAnnouncements: document.getElementById('val-announcements'),
    valIssues: document.getElementById('val-issues'),
    valDeprecations: document.getElementById('val-deprecations'),
    
    // Controls
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterPillsContainer: document.getElementById('filter-pills-container'),
    sortDesc: document.getElementById('sort-desc'),
    sortAsc: document.getElementById('sort-asc'),
    viewGrouped: document.getElementById('view-grouped'),
    viewFeed: document.getElementById('view-feed'),
    
    // Containers
    warningBanner: document.getElementById('warning-banner'),
    warningText: document.getElementById('warning-text'),
    closeWarning: document.getElementById('close-warning'),
    skeletonLoader: document.getElementById('skeleton-loader'),
    emptyState: document.getElementById('empty-state'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    releasesContainer: document.getElementById('releases-container'),
    
    // Modal
    tweetModal: document.getElementById('tweet-modal'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    previewBadge: document.getElementById('preview-badge'),
    previewDate: document.getElementById('preview-date'),
    previewOriginalText: document.getElementById('preview-original-text'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    tagPillsContainer: document.getElementById('tag-pills-container'),
    charCounter: document.getElementById('char-counter'),
    charRingProgress: document.getElementById('char-ring-progress'),
    charRingWrapper: document.querySelector('.char-count-wrapper'),
    twitterPreviewBody: document.getElementById('twitter-preview-body'),
    btnCopyTweet: document.getElementById('btn-copy-tweet'),
    btnTweetIntent: document.getElementById('btn-tweet-intent'),
    
    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message'),
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    fetchReleases();
    setupEventListeners();
});

// Setup DOM Event Listeners
function setupEventListeners() {
    // Refresh action
    els.btnRefresh.addEventListener('click', () => fetchReleases(true));
    
    // Search input
    els.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        els.clearSearch.style.display = state.searchQuery ? 'block' : 'none';
        render();
    });
    
    els.clearSearch.addEventListener('click', () => {
        els.searchInput.value = '';
        state.searchQuery = '';
        els.clearSearch.style.display = 'none';
        render();
    });
    
    // Reset filters empty state button
    els.btnResetFilters.addEventListener('click', resetAllFilters);
    
    // Warning banner close
    els.closeWarning.addEventListener('click', () => {
        els.warningBanner.style.display = 'none';
    });
    
    // Metric cards clicks (filters)
    document.querySelectorAll('.metric-card').forEach(card => {
        card.addEventListener('click', () => {
            const filter = card.getAttribute('data-filter');
            setActiveFilter(filter);
        });
    });
    
    // Filter pills clicks
    els.filterPillsContainer.addEventListener('click', (e) => {
        const pill = e.target.closest('.pill');
        if (!pill) return;
        const filter = pill.getAttribute('data-filter');
        setActiveFilter(filter);
    });
    
    // Sort toggles
    els.sortDesc.addEventListener('click', () => setSortOrder('desc'));
    els.sortAsc.addEventListener('click', () => setSortOrder('asc'));
    
    // Layout view toggles
    els.viewGrouped.addEventListener('click', () => setViewMode('grouped'));
    els.viewFeed.addEventListener('click', () => setViewMode('feed'));
    
    // Modal events
    els.btnCloseModal.addEventListener('click', closeTweetModal);
    els.tweetModal.addEventListener('click', (e) => {
        if (e.target === els.tweetModal) closeTweetModal();
    });
    
    els.tweetTextarea.addEventListener('input', updateTweetPreview);
    
    // Modal Copy Tweet action
    els.btnCopyTweet.addEventListener('click', () => {
        const text = els.tweetTextarea.value;
        navigator.clipboard.writeText(text)
            .then(() => showToast('Tweet text copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy text', 'error'));
    });
    
    // Hashtags helper in modal
    els.tagPillsContainer.addEventListener('click', (e) => {
        const tagButton = e.target.closest('.tag-pill');
        if (!tagButton) return;
        
        const tagText = tagButton.getAttribute('data-tag');
        const currentText = els.tweetTextarea.value;
        
        if (tagButton.classList.contains('active')) {
            // Remove tag
            const escapedTag = tagText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`\\s*${escapedTag}`, 'g');
            els.tweetTextarea.value = currentText.replace(regex, '').trim();
            tagButton.classList.remove('active');
        } else {
            // Add tag
            els.tweetTextarea.value = currentText.trim() + ' ' + tagText;
            tagButton.classList.add('active');
        }
        updateTweetPreview();
    });
}

// Fetch Release Notes
function fetchReleases(forceRefresh = false) {
    // Show spinner & indicator loading state
    els.btnRefresh.classList.add('spinning');
    els.btnRefresh.disabled = true;
    els.syncDot.className = 'status-indicator-dot loading';
    els.syncTimeLabel.textContent = forceRefresh ? 'Fetching live feed...' : 'Loading cached feed...';
    
    // If not first load and refreshing, show content skeletons instead of freezing
    if (forceRefresh) {
        els.releasesContainer.style.opacity = '0.5';
    } else {
        els.skeletonLoader.style.display = 'block';
        els.releasesContainer.style.display = 'none';
        els.emptyState.style.display = 'none';
    }
    
    const url = `/api/releases${forceRefresh ? '?refresh=true' : ''}`;
    
    fetch(url)
        .then(res => {
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            // Process data
            processFetchedData(data);
            
            // Warning handling
            if (data.warning) {
                els.warningText.textContent = data.warning;
                els.warningBanner.style.display = 'flex';
            } else {
                els.warningBanner.style.display = 'none';
            }
            
            showToast(forceRefresh ? 'Refreshed latest release notes!' : 'Loaded release notes successfully.', 'success');
        })
        .catch(err => {
            console.error(err);
            showToast(`Error: ${err.message}`, 'error');
            els.releasesContainer.innerHTML = `<div class="error-state"><p>Failed to load data: ${err.message}</p></div>`;
            els.skeletonLoader.style.display = 'none';
            els.releasesContainer.style.display = 'block';
        })
        .finally(() => {
            els.btnRefresh.classList.remove('spinning');
            els.btnRefresh.disabled = false;
            els.syncDot.className = 'status-indicator-dot online';
            els.releasesContainer.style.opacity = '1';
        });
}

// Process and Flatten Data structure
function processFetchedData(data) {
    state.rawReleases = data.releases || [];
    
    // Flatten releases into individual updates
    const updates = [];
    state.rawReleases.forEach(entry => {
        const date = entry.date;
        const updated = entry.updated;
        const entryId = entry.id;
        
        entry.updates.forEach((up, idx) => {
            updates.push({
                id: `${entryId}-${idx}`,
                date: date,
                updated: updated,
                type: up.type || 'Update',
                html: up.html,
                text: up.text,
                links: up.links || []
            });
        });
    });
    
    state.flatUpdates = updates;
    
    // Update Sync Timer Label
    updateSyncTimeLabel(data.last_fetched);
    
    // Update dashboard counter totals
    calculateMetricTotals();
    
    // Hide Skeletons
    els.skeletonLoader.style.display = 'none';
    els.releasesContainer.style.display = 'block';
    
    // Render Dashboard
    render();
}

// Calculate Metric card numbers based on total loaded updates
function calculateMetricTotals() {
    const counts = {
        total: state.flatUpdates.length,
        Feature: 0,
        Announcement: 0,
        Issue: 0,
        Deprecation: 0
    };
    
    state.flatUpdates.forEach(up => {
        if (counts[up.type] !== undefined) {
            counts[up.type]++;
        } else if (up.type === 'Issue' || up.type === 'Fix' || up.type === 'Security') {
            counts.Issue++; // Group issues and critical fixes together in dashboard metrics
        } else if (up.type === 'Deprecation') {
            counts.Deprecation++;
        }
    });
    
    // Update DOM counts
    els.valTotal.textContent = counts.total;
    els.valFeatures.textContent = counts.Feature;
    els.valAnnouncements.textContent = counts.Announcement;
    els.valIssues.textContent = counts.Issue;
    els.valDeprecations.textContent = counts.Deprecation;
}

// Set last fetched relative timestamp
function updateSyncTimeLabel(timestamp) {
    if (!timestamp) {
        els.syncTimeLabel.textContent = 'Sync time unknown';
        return;
    }
    
    const fetchedTime = new Date(timestamp * 1000);
    
    const updateRelativeTime = () => {
        const diffSeconds = Math.floor((new Date() - fetchedTime) / 1000);
        
        if (diffSeconds < 60) {
            els.syncTimeLabel.textContent = 'Synced just now';
        } else if (diffSeconds < 3600) {
            const mins = Math.floor(diffSeconds / 60);
            els.syncTimeLabel.textContent = `Synced ${mins}m ago`;
        } else {
            const hrs = Math.floor(diffSeconds / 3600);
            els.syncTimeLabel.textContent = `Synced ${hrs}h ago`;
        }
    };
    
    updateRelativeTime();
    
    // Clear existing interval if set
    if (window.syncInterval) clearInterval(window.syncInterval);
    window.syncInterval = setInterval(updateRelativeTime, 30000);
}

// Set Type filter from metric cards or pills
function setActiveFilter(filter) {
    state.activeFilter = filter;
    
    // Update Metric Cards visual selection
    document.querySelectorAll('.metric-card').forEach(card => {
        if (card.getAttribute('data-filter') === filter) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
    
    // Update Pills visual selection
    document.querySelectorAll('.pill').forEach(pill => {
        if (pill.getAttribute('data-filter') === filter) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
    
    render();
}

// Sort order handler
function setSortOrder(order) {
    state.sortBy = order;
    els.sortDesc.classList.toggle('active', order === 'desc');
    els.sortAsc.classList.toggle('active', order === 'asc');
    render();
}

// Layout view mode handler
function setViewMode(mode) {
    state.viewMode = mode;
    els.viewGrouped.classList.toggle('active', mode === 'grouped');
    els.viewFeed.classList.toggle('active', mode === 'feed');
    render();
}

// Reset filters to default state
function resetAllFilters() {
    state.activeFilter = 'all';
    state.searchQuery = '';
    els.searchInput.value = '';
    els.clearSearch.style.display = 'none';
    
    // Sync UI elements
    setActiveFilter('all');
    render();
}

// Filtering & Sorting Process
function getFilteredAndSortedUpdates() {
    let list = [...state.flatUpdates];
    
    // 1. Filter by Update Type
    if (state.activeFilter !== 'all') {
        list = list.filter(up => {
            if (state.activeFilter === 'Issue') {
                return up.type === 'Issue' || up.type === 'Fix';
            }
            return up.type === state.activeFilter;
        });
    }
    
    // 2. Filter by Search Query
    if (state.searchQuery) {
        list = list.filter(up => {
            return (
                up.text.toLowerCase().includes(state.searchQuery) ||
                up.type.toLowerCase().includes(state.searchQuery) ||
                up.date.toLowerCase().includes(state.searchQuery)
            );
        });
    }
    
    // 3. Sort List
    list.sort((a, b) => {
        const dateA = new Date(a.updated || a.date);
        const dateB = new Date(b.updated || b.date);
        return state.sortBy === 'desc' ? dateB - dateA : dateA - dateB;
    });
    
    return list;
}

// Main Render Function
function render() {
    const list = getFilteredAndSortedUpdates();
    
    // Handle empty state
    if (list.length === 0) {
        els.emptyState.style.display = 'flex';
        els.releasesContainer.style.display = 'none';
        return;
    }
    
    els.emptyState.style.display = 'none';
    els.releasesContainer.style.display = 'block';
    
    if (state.viewMode === 'feed') {
        renderFeedView(list);
    } else {
        renderGroupedView(list);
    }
}

// Render feed layout (flat timeline view)
function renderFeedView(updates) {
    els.releasesContainer.className = 'releases-wrapper feed-layout';
    
    let html = '';
    updates.forEach(up => {
        html += renderUpdateCardHTML(up, true);
    });
    
    els.releasesContainer.innerHTML = html;
    attachCardActionListeners();
}

// Render grouped layout (Accordion groups by date)
function renderGroupedView(updates) {
    els.releasesContainer.className = 'releases-wrapper';
    
    // Group updates by date string
    const groups = {};
    updates.forEach(up => {
        if (!groups[up.date]) {
            groups[up.date] = [];
        }
        groups[up.date].push(up);
    });
    
    // Determine render order of dates based on sorting
    const uniqueDates = Object.keys(groups).sort((a, b) => {
        // Find reference timestamps for the group
        const refA = new Date(groups[a][0].updated || a);
        const refB = new Date(groups[b][0].updated || b);
        return state.sortBy === 'desc' ? refB - refA : refA - refB;
    });
    
    let html = '';
    uniqueDates.forEach(dateStr => {
        const groupUpdates = groups[dateStr];
        const isCollapsed = state.collapsedGroups[dateStr] === true;
        
        html += `
            <div class="date-group ${isCollapsed ? 'collapsed' : ''}" data-date="${dateStr}">
                <button class="date-header" aria-expanded="${!isCollapsed}" aria-label="Toggle ${dateStr} updates">
                    <div class="date-header-left">
                        <span class="date-title">${dateStr}</span>
                        <span class="date-count-badge">${groupUpdates.length} update${groupUpdates.length > 1 ? 's' : ''}</span>
                    </div>
                    <svg class="date-header-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </button>
                <div class="date-content">
                    ${groupUpdates.map(up => renderUpdateCardHTML(up, false)).join('')}
                </div>
            </div>
        `;
    });
    
    els.releasesContainer.innerHTML = html;
    
    // Add Accordion headers click handlers
    document.querySelectorAll('.date-header').forEach(header => {
        header.addEventListener('click', (e) => {
            const groupEl = header.closest('.date-group');
            const dateStr = groupEl.getAttribute('data-date');
            const collapsed = !groupEl.classList.contains('collapsed');
            
            // Toggle local UI immediately
            groupEl.classList.toggle('collapsed', collapsed);
            header.setAttribute('aria-expanded', !collapsed);
            
            // Save state
            state.collapsedGroups[dateStr] = collapsed;
        });
    });
    
    attachCardActionListeners();
}

// Generate single card HTML structure
function renderUpdateCardHTML(up, showDate = false) {
    const badgeClass = `badge-${up.type.toLowerCase()}`;
    const dateSection = showDate ? `<span class="card-date">${up.date}</span>` : '';
    
    return `
        <article class="update-card" data-id="${up.id}" data-type="${up.type}">
            <div class="card-header">
                <div class="badge-wrapper">
                    <span class="badge ${badgeClass}">${up.type}</span>
                </div>
                ${dateSection}
            </div>
            <div class="card-body">
                ${up.html}
            </div>
            <div class="card-actions">
                <button class="btn-card-action btn-copy-update" title="Copy update text to clipboard">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    <span>Copy</span>
                </button>
                <button class="btn-card-action btn-card-action-tweet" title="Customize and Tweet about this update">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>
                    <span>Tweet</span>
                </button>
            </div>
        </article>
    `;
}

// Wire actions for dynamically rendered cards
function attachCardActionListeners() {
    // Copy Update listener
    document.querySelectorAll('.btn-copy-update').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardEl = btn.closest('.update-card');
            const updateId = cardEl.getAttribute('data-id');
            const up = state.flatUpdates.find(u => u.id === updateId);
            
            if (up) {
                const copyText = `Google Cloud BigQuery Update (${up.date}) [${up.type}]:\n${up.text}`;
                navigator.clipboard.writeText(copyText)
                    .then(() => showToast('Update copied to clipboard!', 'success'))
                    .catch(() => showToast('Failed to copy update', 'error'));
            }
        });
    });
    
    // Open Tweet Composer listener
    document.querySelectorAll('.btn-card-action-tweet').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardEl = btn.closest('.update-card');
            const updateId = cardEl.getAttribute('data-id');
            const up = state.flatUpdates.find(u => u.id === updateId);
            
            if (up) {
                openTweetModal(up);
            }
        });
    });
}

// Tweet Customizer Logic
function openTweetModal(update) {
    // 1. Clean previous hashtag helper selection
    document.querySelectorAll('.tag-pill').forEach(btn => btn.classList.remove('active'));
    
    // 2. Load preview details
    els.previewBadge.className = `badge badge-${update.type.toLowerCase()}`;
    els.previewBadge.textContent = update.type;
    els.previewDate.textContent = update.date;
    els.previewOriginalText.textContent = update.text;
    
    // 3. Draft base tweet text
    // Pick the first document link if exists, otherwise default feed url
    const refUrl = update.links.length > 0 ? update.links[0] : 'https://cloud.google.com/bigquery/docs/release-notes';
    
    // Clean text to avoid too much spacing, summarize or slice
    let summaryText = update.text.trim();
    if (summaryText.length > 150) {
        summaryText = summaryText.slice(0, 147) + '...';
    }
    
    // Pre-populate textarea
    const draftText = `📢 BigQuery ${update.type} (${update.date}):\n"${summaryText}"\n\nRead more: ${refUrl}`;
    els.tweetTextarea.value = draftText;
    
    // If the default text contains standard hashtags, mark active
    // (None in default template, but tags helper is available)
    
    updateTweetPreview();
    
    // 4. Open Modal with Animation classes
    els.tweetModal.style.display = 'flex';
    setTimeout(() => {
        els.tweetModal.classList.add('open');
        els.tweetTextarea.focus();
    }, 10);
}

function closeTweetModal() {
    els.tweetModal.classList.remove('open');
    setTimeout(() => {
        els.tweetModal.style.display = 'none';
    }, 300);
}

function updateTweetPreview() {
    const text = els.tweetTextarea.value;
    const charCount = text.length;
    const limit = 280;
    const remaining = limit - charCount;
    
    // Update text counter
    els.charCounter.textContent = remaining;
    
    // Set counters warning colors
    els.charCounter.className = '';
    els.charRingWrapper.className = 'char-count-wrapper';
    
    if (remaining < 0) {
        els.charCounter.classList.add('danger');
        els.charRingWrapper.classList.add('char-counter-danger');
    } else if (remaining <= 30) {
        els.charCounter.classList.add('warning');
        els.charRingWrapper.classList.add('char-counter-warning');
    }
    
    // Animate circular ring progress
    const pct = Math.min(100, Math.max(0, (charCount / limit) * 100));
    // SVG stroke-dasharray = 'percentage, 100'
    els.charRingProgress.style.strokeDasharray = `${pct}, 100`;
    
    // Render Simulated Post Preview with styled elements
    let displayHtml = escapeHtml(text);
    
    // Style hashtags: #word -> <span class="hashtag">#word</span>
    displayHtml = displayHtml.replace(/(^|\s)(#[a-zA-Z0-9_]+)/g, '$1<span class="hashtag">$2</span>');
    
    // Style URLs: https://... -> <span class="url-link">https://...</span>
    displayHtml = displayHtml.replace(/(https?:\/\/[^\s]+)/g, '<span class="url-link">$1</span>');
    
    els.twitterPreviewBody.innerHTML = displayHtml;
    
    // Update Web Intent link
    const encodedText = encodeURIComponent(text);
    els.btnTweetIntent.href = `https://twitter.com/intent/tweet?text=${encodedText}`;
    
    // Set tweet intents target window
    els.btnTweetIntent.setAttribute('target', '_blank');
}

// Utility HTML escape function
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Show System Toast Feedback
function showToast(message, type = 'success') {
    els.toastMessage.textContent = message;
    els.toast.className = `toast show ${type}`;
    
    // Clear existing timer if toast is refreshed
    if (window.toastTimer) clearTimeout(window.toastTimer);
    
    window.toastTimer = setTimeout(() => {
        els.toast.classList.remove('show');
    }, 3500);
}
