const TYPE_LABELS = {
    mcq: 'বহুনির্বাচনী প্রশ্ন',
    blanks: 'শূন্যস্থান পূরণ',
    shorts: 'সংক্ষিপ্ত প্রশ্ন ও উত্তর',
    words: 'অনুশীলনীর প্রশ্ন ও সমাধান'
};

let viewerData = { chapters: [] };
let selectedClass = '';
let selectedChapterKey = '';
let bannerTimer = null;
const VIEWER_STORAGE_KEY = 'noteViewerProState';
const DEFAULT_DATA_CACHE_KEY = 'noteViewerDefaultCache';
let dataSourceLabel = 'None';
let searchTerm = '';
let searchScope = 'chapter';
let activeSourceMode = 'default';

function showBanner(message) {
    const banner = document.getElementById('notificationBanner');
    const bannerText = document.getElementById('bannerText');
    clearTimeout(bannerTimer);
    bannerText.textContent = message;
    banner.classList.remove('hidden');
    banner.classList.remove('hide');
    banner.classList.add('show');
    bannerTimer = setTimeout(() => {
        banner.classList.remove('show');
        banner.classList.add('hide');
        setTimeout(() => {
            banner.classList.add('hidden');
            banner.classList.remove('hide');
        }, 300);
    }, 2000);
}

function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatFractions(text) {
    const escaped = escapeHtml(text ?? '');
    return escaped.replace(/([^\s/]+)\/([^\s/]+)/g, (_, top, bottom) => {
        return `<span class="fraction"><span class="fraction-top">${top}</span><span class="fraction-bottom">${bottom}</span></span>`;
    });
}

function getClassList() {
    return [...new Set(viewerData.chapters.map(item => item.class).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
}

function getChapterList(classValue) {
    return viewerData.chapters
        .filter(item => item.class === classValue)
        .sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber));
}

function getSelectedChapter() {
    return viewerData.chapters.find(item => `${item.class}-${item.chapterNumber}` === selectedChapterKey) || null;
}

function saveViewerState() {
    localStorage.setItem(VIEWER_STORAGE_KEY, JSON.stringify({
        selectedClass,
        selectedChapterKey,
        searchTerm,
        searchScope
    }));
}

function cacheDefaultData(data) {
    localStorage.setItem(DEFAULT_DATA_CACHE_KEY, JSON.stringify(data));
}

function getCachedDefaultData() {
    try {
        const cached = JSON.parse(localStorage.getItem(DEFAULT_DATA_CACHE_KEY) || 'null');
        return Array.isArray(cached?.chapters) ? cached : null;
    } catch (error) {
        console.error(error);
        return null;
    }
}

function restoreSelection() {
    const classes = getClassList();
    if (!classes.length) {
        selectedClass = '';
        selectedChapterKey = '';
        return;
    }

    if (!classes.includes(selectedClass)) {
        selectedClass = classes[0];
    }

    const chapters = getChapterList(selectedClass);
    const hasSelectedChapter = chapters.some(item => `${item.class}-${item.chapterNumber}` === selectedChapterKey);
    selectedChapterKey = hasSelectedChapter
        ? selectedChapterKey
        : chapters[0]
            ? `${chapters[0].class}-${chapters[0].chapterNumber}`
            : '';
}

function normalizeSearchText(text) {
    return String(text ?? '').toLowerCase();
}

function itemMatchesSearch(item, query) {
    if (!query) return true;
    const haystack = normalizeSearchText([
        item.id,
        item.question,
        item.answer,
        item.questionKo,
        item.questionKho,
        item.solution,
        item.solutionKo,
        item.solutionKho,
        item.tag,
        item.hardness
    ].filter(Boolean).join(' '));
    return haystack.includes(query);
}

function getScopeChapters() {
    if (!selectedClass) return [];
    if (searchScope === 'class') return getChapterList(selectedClass);
    const chapter = getSelectedChapter();
    return chapter ? [chapter] : [];
}

function getFilteredScopeData() {
    const query = normalizeSearchText(searchTerm.trim());
    const chapters = getScopeChapters();
    const aggregated = {
        mcq: [],
        blanks: [],
        shorts: [],
        words: []
    };

    chapters.forEach(chapter => {
        const content = chapter.content || {};
        Object.keys(aggregated).forEach(type => {
            (content[type] || []).forEach(item => {
                if (itemMatchesSearch(item, query)) {
                    aggregated[type].push({
                        ...item,
                        __chapterNumber: chapter.chapterNumber,
                        __chapterTitle: chapter.chapterTitle || ''
                    });
                }
            });
        });
    });

    return aggregated;
}

function updateSearchScopeButtons() {
    const chapterBtn = document.getElementById('chapterSearchBtn');
    const classBtn = document.getElementById('classSearchBtn');
    if (!chapterBtn || !classBtn) return;

    chapterBtn.className = `px-3 py-1 rounded-lg ${searchScope === 'chapter' ? 'bg-blue-400 text-white' : 'bg-slate-200'}`;
    classBtn.className = `px-3 py-1 rounded-lg ${searchScope === 'class' ? 'bg-blue-400 text-white' : 'bg-slate-200'}`;
}

function jumpToSection(sectionKey, label) {
    const target = document.getElementById(`section-${sectionKey}`);
    if (!target) {
        showBanner(`${label} section not available!`);
        return;
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showBanner(`${label} section opened!`);
}

function renderReport() {
    const chapter = getSelectedChapter();
    const totalChapters = viewerData.chapters.length;
    const scopeData = getFilteredScopeData();
    const selectedCount = Object.values(scopeData).reduce((sum, items) => sum + (items?.length || 0), 0);

    document.getElementById('viewerReport').innerHTML = `
        <div>Source: ${escapeHtml(dataSourceLabel)}</div>
        <div>Total Chapters: ${totalChapters}</div>
        <div>Selected Class: ${selectedClass || '-'}</div>
        <div>Selected Chapter: ${chapter ? `${chapter.chapterNumber} - ${chapter.chapterTitle || '-'}` : '-'}</div>
        <div>Search Scope: ${searchScope === 'class' ? 'All In Class' : 'Opened Chapter'}</div>
        <div>Search Text: ${searchTerm ? escapeHtml(searchTerm) : '-'}</div>
        <div>Visible Items: ${selectedCount}</div>
    `;
}

function renderClassSelectors() {
    const wrap = document.getElementById('classSelectors');
    const classes = getClassList();
    wrap.innerHTML = classes.map(cls => `
        <button onclick="selectClass('${cls}')"
            class="px-3 py-1 rounded-lg text-xs ${selectedClass === cls ? 'bg-green-500 text-white' : 'bg-slate-200'}">${cls}</button>
    `).join('');
}

function renderChapterSelectors() {
    const wrap = document.getElementById('chapterSelectors');
    if (!selectedClass) {
        wrap.innerHTML = '<div class="text-sm text-slate-600">Select a class first.</div>';
        return;
    }

    const chapters = getChapterList(selectedClass);
    wrap.innerHTML = chapters.map(chapter => {
        const key = `${chapter.class}-${chapter.chapterNumber}`;
        const selected = selectedChapterKey === key;
        const label = selected
            ? `${chapter.chapterNumber}`
            : `${chapter.chapterNumber} - ${chapter.chapterTitle || 'Untitled'}`;

        return `<button onclick="selectChapter('${key}')"
            class="px-3 py-2 rounded-lg text-sm text-left ${selected ? 'bg-blue-400 text-white' : 'bg-slate-200'}">${escapeHtml(label)}</button>`;
    }).join('');
}

function renderSectionHeading(key, label, count) {
    return `<div id="section-${key}" class="rounded-xl bg-white/70 px-4 py-2 text-lg font-bold shadow backdrop-blur-[2px]">${label} (${count})</div>`;
}

function renderMetaLine(item, index) {
    const chapterInfo = searchScope === 'class'
        ? ` | Chapter ${escapeHtml(item.__chapterNumber || '')}${item.__chapterTitle ? ` - ${escapeHtml(item.__chapterTitle)}` : ''}`
        : '';
    return `<div class="mb-2 text-gray-500 font-mono">#${index + 1} | ID: ${item.id}${chapterInfo}</div>`;
}

function renderEditableBlock(title, value, amber = false, preserve = false) {
    const cls = amber ? 'bg-amber-50 border border-amber-200' : 'bg-slate-100';
    const preserveClass = preserve ? 'whitespace-pre-wrap' : '';
    return `
        <div class="mt-2 flex items-start justify-between gap-2 rounded-lg px-3 py-2 ${cls}">
            <div class="flex-1">
                <div class="text-xs uppercase opacity-70 mb-1">${title}</div>
                <div class="bnFont editableValue cursor-text font-semibold ${preserveClass}">${formatFractions(value || '')}</div>
            </div>
        </div>
    `;
}

function renderMcq(items) {
    return items.map((q, index) => `
        <div class="bg-white p-4 rounded-xl shadow transition-all duration-200 hover:-translate-y-0.5">
            ${renderMetaLine(q, index)}
            <div class="flex w-auto items-center gap-2 rounded bg-slate-100 px-2 py-1 transition-all duration-150">
                <span class="bnFont font-semibold text-lg">${formatFractions(q.question)}</span>
            </div>
            <div class="bnFont grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">${(q.options || []).map(o => `<div
                class="flex gap-2 rounded-lg px-3 py-2 transition-all duration-150 ${o.isCorrect ? 'border-green-400 bg-green-400 text-white' : 'border-slate-200 bg-slate-100'}">
                <span class="w-full font-semibold">${formatFractions(o.text)}</span>
            </div>`).join('')}</div>
        </div>
    `).join('');
}

function renderSimple(items, type) {
    return items.map((q, index) => `
        <div class="bg-white p-4 rounded-xl shadow transition-all duration-200 hover:-translate-y-0.5">
            ${renderMetaLine(q, index)}
            ${renderEditableBlock('Question', q.question)}
            ${type !== 'words' ? renderEditableBlock('Answer', q.answer, true) : ''}
            ${type === 'words' && q.questionKo ? renderEditableBlock('Question (ক)', q.questionKo) : ''}
            ${type === 'words' && q.questionKho ? renderEditableBlock('Question (খ)', q.questionKho) : ''}
            ${type === 'words' && q.solution ? renderEditableBlock('Solution', q.solution, true, true) : ''}
            ${type === 'words' && q.solutionKo ? renderEditableBlock('Solution (ক)', q.solutionKo, true, true) : ''}
            ${type === 'words' && q.solutionKho ? renderEditableBlock('Solution (খ)', q.solutionKho, true, true) : ''}
        </div>
    `).join('');
}

function renderOutput() {
    const output = document.getElementById('viewerOutput');
    const chapter = getSelectedChapter();
    const scopeData = getFilteredScopeData();
    const visibleCount = Object.values(scopeData).reduce((sum, items) => sum + (items?.length || 0), 0);

    if (!chapter) {
        output.innerHTML = `<div class="card bg-white p-6 rounded-xl shadow text-center">Load a data file, select a class, then choose a chapter.</div>`;
        return;
    }

    if (!visibleCount) {
        output.innerHTML = `<div class="card bg-white p-6 rounded-xl shadow text-center">No matching items found.</div>`;
        return;
    }

    const sections = [];
    const content = scopeData;

    if (content.mcq?.length) {
        sections.push(renderSectionHeading('mcq', TYPE_LABELS.mcq, content.mcq.length));
        sections.push(renderMcq(content.mcq));
    }
    if (content.blanks?.length) {
        sections.push(renderSectionHeading('blanks', TYPE_LABELS.blanks, content.blanks.length));
        sections.push(renderSimple(content.blanks, 'blanks'));
    }
    if (content.shorts?.length) {
        sections.push(renderSectionHeading('shorts', TYPE_LABELS.shorts, content.shorts.length));
        sections.push(renderSimple(content.shorts, 'shorts'));
    }
    if (content.words?.length) {
        sections.push(renderSectionHeading('words', TYPE_LABELS.words, content.words.length));
        sections.push(renderSimple(content.words, 'words'));
    }

    output.innerHTML = sections.join('') || `<div class="card bg-white p-6 rounded-xl shadow text-center">This chapter has no parsed items.</div>`;
}

function selectClass(value) {
    selectedClass = value;
    const chapters = getChapterList(value);
    selectedChapterKey = chapters.length ? `${chapters[0].class}-${chapters[0].chapterNumber}` : '';
    renderClassSelectors();
    renderChapterSelectors();
    renderReport();
    renderOutput();
    saveViewerState();
    showBanner(`Class ${value} selected!`);
}

function selectChapter(key) {
    selectedChapterKey = key;
    renderChapterSelectors();
    renderReport();
    renderOutput();
    saveViewerState();
    const chapter = getSelectedChapter();
    if (chapter) {
        showBanner(`Chapter ${chapter.chapterNumber} opened!`);
    }
}

function loadData(data, sourceLabel = 'Loaded file', preserveSelection = false, sourceMode = 'default') {
    viewerData = Array.isArray(data?.chapters) ? data : { chapters: [] };
    dataSourceLabel = sourceLabel;
    activeSourceMode = sourceMode;
    if (!preserveSelection) {
        selectedClass = '';
        selectedChapterKey = '';
    }
    updateSearchScopeButtons();
    restoreSelection();
    renderClassSelectors();
    renderChapterSelectors();
    renderReport();
    renderOutput();
    saveViewerState();
}

function loadSavedState() {
    try {
        const saved = JSON.parse(localStorage.getItem(VIEWER_STORAGE_KEY) || 'null');
        if (!saved) return false;

        selectedClass = saved.selectedClass || '';
        selectedChapterKey = saved.selectedChapterKey || '';
        searchTerm = saved.searchTerm || '';
        searchScope = saved.searchScope === 'class' ? 'class' : 'chapter';
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = searchTerm;
        updateSearchScopeButtons();
        return true;
    } catch (error) {
        console.error(error);
        return false;
    }
}

async function tryLoadDefaultData() {
    try {
        const response = await fetch('./notes-data.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        cacheDefaultData(data);
        loadData(data, 'notes-data.json', true, 'default');
        showBanner('Loaded latest notes-data.json!');
        return true;
    } catch (error) {
        return false;
    }
}

function tryLoadCachedDefaultData() {
    const cached = getCachedDefaultData();
    if (!cached) return false;
    loadData(cached, 'notes-data.json (cached)', true, 'cache');
    showBanner('Offline: loaded cached notes-data.json');
    return true;
}

document.getElementById('jsonFileInput').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            loadData(data, `${file.name} (manual override)`, false, 'manual');
            showBanner('Manual file override loaded!');
        } catch (error) {
            console.error(error);
            showBanner('Invalid JSON file!');
        }
    };
    reader.readAsText(file);
});

document.getElementById('searchInput').addEventListener('input', event => {
    searchTerm = event.target.value;
    renderReport();
    renderOutput();
    saveViewerState();
});

document.getElementById('clearSearchBtn').addEventListener('click', () => {
    searchTerm = '';
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    renderReport();
    renderOutput();
    saveViewerState();
    showBanner('Search cleared!');
});

document.getElementById('chapterSearchBtn').addEventListener('click', () => {
    searchScope = 'chapter';
    updateSearchScopeButtons();
    renderReport();
    renderOutput();
    saveViewerState();
    showBanner('Search scope: opened chapter');
});

document.getElementById('classSearchBtn').addEventListener('click', () => {
    searchScope = 'class';
    updateSearchScopeButtons();
    renderReport();
    renderOutput();
    saveViewerState();
    showBanner('Search scope: all chapters in class');
});

document.getElementById('jumpMcqBtn').addEventListener('click', () => {
    jumpToSection('mcq', 'MCQ');
});

document.getElementById('jumpBlankBtn').addEventListener('click', () => {
    jumpToSection('blanks', 'Blank');
});

document.getElementById('jumpShortBtn').addEventListener('click', () => {
    jumpToSection('shorts', 'Short');
});

document.getElementById('jumpWordBtn').addEventListener('click', () => {
    jumpToSection('words', 'Word');
});

window.addEventListener('online', async () => {
    if (activeSourceMode === 'manual') return;
    const loadedDefault = await tryLoadDefaultData();
    if (loadedDefault) {
        showBanner('Back online: notes-data.json refreshed!');
    }
});

window.onload = async () => {
    updateSearchScopeButtons();
    loadSavedState();

    const loadedDefault = await tryLoadDefaultData();
    if (loadedDefault) return;

    const loadedCached = tryLoadCachedDefaultData();
    if (loadedCached) return;

    renderClassSelectors();
    renderChapterSelectors();
    renderReport();
    renderOutput();
};
