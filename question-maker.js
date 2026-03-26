const QM_COUNT_PRESETS = {
    100: {
        mcq: 20,
        blanks: 10,
        shorts: 12,
        words: 11,
        geometry: 2
    },
    50: {
        mcq: 10,
        blanks: 5,
        shorts: 7,
        words: 8,
        geometry: 2
    }
};

const HARDNESS_PROFILES = {
    Easy: { Easy: 0.6, Medium: 0.2, Hard: 0.2 },
    Medium: { Easy: 0.2, Medium: 0.6, Hard: 0.2 },
    Hard: { Easy: 0.2, Medium: 0.2, Hard: 0.6 }
};

let notesData = { chapters: [] };
let selectedClass = '';
let selectedHardness = 'Hard';
let selectedFullMark = '100';

function showBanner(message) {
    const banner = document.getElementById('notificationBanner');
    const bannerText = document.getElementById('bannerText');
    bannerText.textContent = message;
    banner.classList.remove('hidden');
    banner.classList.add('show');
    setTimeout(() => {
        banner.classList.remove('show');
        banner.classList.add('hidden');
    }, 1800);
}

function setLoading(btn, loading, label) {
    const labelNode = btn.querySelector('.btn-label');
    if (!btn.dataset.originalLabel) {
        btn.dataset.originalLabel = labelNode.textContent;
    }
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
    labelNode.textContent = loading ? label : btn.dataset.originalLabel;
}

async function runAction(btn, label, action) {
    try {
        setLoading(btn, true, label);
        await action();
    } catch (error) {
        console.error(error);
        showBanner(error.message || 'Something went wrong!');
    } finally {
        setLoading(btn, false);
    }
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
    return escapeHtml(text ?? '').replace(/([^\s/]+)\/([^\s/]+)/g, (_, top, bottom) =>
        `<span class="fraction"><span class="fraction-top">${top}</span><span class="fraction-bottom">${bottom}</span></span>`
    );
}

function getClasses() {
    return [...new Set((notesData.chapters || []).map(ch => String(ch.class || '')).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
}

function getSelectedChapters() {
    return [...document.querySelectorAll('#qmChapterList input[type="checkbox"]:checked')].map(input => input.value);
}

function getChaptersForClass() {
    return (notesData.chapters || [])
        .filter(ch => String(ch.class || '') === String(selectedClass || ''))
        .sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber));
}

function renderClassSelectors() {
    const host = document.getElementById('qmClassSelectors');
    const classes = getClasses();
    if (!selectedClass && classes.length) selectedClass = classes[0];
    host.innerHTML = classes.map(cls => `
        <button class="px-3 py-1 rounded-lg text-sm ${selectedClass === cls ? 'bg-blue-400 text-white' : 'bg-slate-200'}" onclick="selectClass('${cls}')">${cls}</button>
    `).join('');
}

function renderChapterList() {
    const host = document.getElementById('qmChapterList');
    const chapters = getChaptersForClass();
    host.innerHTML = chapters.map(ch => `
        <label class="flex items-start gap-2 rounded-lg bg-white px-3 py-2">
            <input type="checkbox" value="${ch.chapterNumber}" checked class="mt-1">
            <span><strong>${ch.chapterNumber}</strong> - ${escapeHtml(ch.chapterTitle || 'Untitled')}</span>
        </label>
    `).join('') || '<div class="text-slate-500">No chapters found.</div>';
    updateReport();
}

function renderHardnessSelectors() {
    const host = document.getElementById('paperHardnessSelectors');
    host.innerHTML = Object.keys(HARDNESS_PROFILES).map(level => `
        <button class="px-3 py-1 rounded-lg text-sm ${selectedHardness === level ? 'bg-purple-500 text-white' : 'bg-slate-200'}" onclick="selectPaperHardness('${level}')">${level}</button>
    `).join('');
}

function renderFullMarkSelectors() {
    const host = document.getElementById('fullMarkSelectors');
    host.innerHTML = ['100', '50'].map(mark => `
        <button class="px-3 py-1 rounded-lg text-sm ${selectedFullMark === mark ? 'bg-pink-500 text-white' : 'bg-slate-200'}" onclick="selectFullMark('${mark}')">${mark}</button>
    `).join('');
}

function selectClass(cls) {
    selectedClass = cls;
    renderClassSelectors();
    renderChapterList();
}

function selectPaperHardness(level) {
    selectedHardness = level;
    renderHardnessSelectors();
    updateReport();
}

function applyCountPreset() {
    const preset = QM_COUNT_PRESETS[selectedFullMark];
    document.getElementById('countMcq').value = preset.mcq;
    document.getElementById('countBlanks').value = preset.blanks;
    document.getElementById('countShorts').value = preset.shorts;
    document.getElementById('countWords').value = preset.words;
    document.getElementById('countGeometry').value = preset.geometry;
}

function selectFullMark(mark) {
    selectedFullMark = mark;
    renderFullMarkSelectors();
    applyCountPreset();
    updateReport();
}

function getRequestedCounts() {
    return {
        mcq: Number(document.getElementById('countMcq').value || 0),
        blanks: Number(document.getElementById('countBlanks').value || 0),
        shorts: Number(document.getElementById('countShorts').value || 0),
        words: Number(document.getElementById('countWords').value || 0),
        geometry: Number(document.getElementById('countGeometry').value || 0)
    };
}

function getSelectedChapterObjects() {
    const chapterNumbers = new Set(getSelectedChapters());
    return getChaptersForClass().filter(ch => chapterNumbers.has(String(ch.chapterNumber)));
}

function isGeometryChapter(chapter) {
    const title = String(chapter?.chapterTitle || '').toLowerCase();
    if (title.includes('geometry') || title.includes('circle') || title.includes('triangle') || title.includes('square')) {
        return true;
    }

    const items = [
        ...(chapter?.content?.mcq || []),
        ...(chapter?.content?.blanks || []),
        ...(chapter?.content?.shorts || []),
        ...(chapter?.content?.words || [])
    ];

    return items.length > 0 && items.every(item => item.tag === 'Geometry');
}

function splitSelectedChapters() {
    const all = getSelectedChapterObjects();
    return {
        regular: all.filter(ch => !isGeometryChapter(ch)),
        geometry: all.filter(isGeometryChapter)
    };
}

function getPoolForSelection() {
    const { regular, geometry } = splitSelectedChapters();
    return {
        mcq: regular.flatMap(ch => ch.content?.mcq || []),
        blanks: regular.flatMap(ch => ch.content?.blanks || []),
        shorts: regular.flatMap(ch => ch.content?.shorts || []),
        words: regular.flatMap(ch => ch.content?.words || []),
        geometry: geometry.flatMap(ch => ch.content?.words || []).filter(item => item.tag === 'Geometry')
    };
}

function shuffle(list) {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function getBalancedOrder(pool) {
    const count = pool.length;
    const profile = HARDNESS_PROFILES[selectedHardness];
    const grouped = {
        Easy: shuffle(pool.filter(item => (item.hardness || 'Easy') === 'Easy')),
        Medium: shuffle(pool.filter(item => item.hardness === 'Medium')),
        Hard: shuffle(pool.filter(item => item.hardness === 'Hard'))
    };

    const targets = {
        Hard: Math.round(count * profile.Hard),
        Medium: Math.round(count * profile.Medium)
    };
    targets.Easy = Math.max(0, count - targets.Hard - targets.Medium);

    const picked = [];
    ['Hard', 'Medium', 'Easy'].forEach(level => {
        while (targets[level] > 0 && grouped[level].length) {
            picked.push(grouped[level].pop());
            targets[level] -= 1;
        }
    });

    const leftovers = shuffle([...grouped.Hard, ...grouped.Medium, ...grouped.Easy]).filter(item => !picked.includes(item));
    while (picked.length < count && leftovers.length) {
        picked.push(leftovers.pop());
    }

    return picked.concat(leftovers.filter(item => !picked.includes(item)));
}

function pickBalanced(pool, count) {
    return getBalancedOrder(pool).slice(0, count);
}

function pickChapterCovered(chapters, typeKey, count, required = false) {
    const selected = [];
    const selectedIds = new Set();
    const chapterPools = chapters.map(ch => ({
        chapterNumber: String(ch.chapterNumber || ''),
        items: getBalancedOrder(typeKey === 'geometry'
            ? (ch.content?.words || []).filter(item => item.tag === 'Geometry')
            : (ch.content?.[typeKey] || []))
    })).filter(entry => entry.items.length);

    if (required) {
        chapterPools.forEach(entry => {
            if (selected.length >= count) return;
            const next = entry.items.find(item => !selectedIds.has(item.id));
            if (next) {
                selected.push(next);
                selectedIds.add(next.id);
            }
        });
    }

    if (!required && chapterPools.length && count >= chapterPools.length) {
        chapterPools.forEach(entry => {
            if (selected.length >= count) return;
            const next = entry.items.find(item => !selectedIds.has(item.id));
            if (next) {
                selected.push(next);
                selectedIds.add(next.id);
            }
        });
    }

    const allItems = getBalancedOrder(chapterPools.flatMap(entry => entry.items)).filter(item => !selectedIds.has(item.id));
    while (selected.length < count && allItems.length) {
        const next = allItems.shift();
        selected.push(next);
        selectedIds.add(next.id);
    }

    return selected.slice(0, count);
}

function renderGeneratedSection(title, items, type) {
    if (!items.length) return '';
    return `
        <section class="bg-white p-4 rounded-xl shadow space-y-3">
            <div class="text-lg font-bold">${title} (${items.length})</div>
            ${items.map((item, index) => `
                <article class="rounded-lg bg-slate-50 p-3">
                    <div class="mb-1 text-xs uppercase text-slate-500">#${index + 1} | ${type} | ${item.hardness || 'Easy'} | Chapter ${item.chapter || '-'}</div>
                    <div class="bnFont font-semibold">${formatFractions(item.question || '')}</div>
                    ${Array.isArray(item.options) && item.options.length ? `
                        <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 bnFont">
                            ${item.options.map(option => `
                                <div class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                                    <span class="font-semibold">${escapeHtml(option.key || '')})</span>
                                    <span>${formatFractions(option.text || '')}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${item.answer ? `<div class="mt-3 rounded-lg bg-white px-3 py-2 text-sm bnFont"><span class="font-semibold">Answer:</span> ${formatFractions(item.answer)}</div>` : ''}
                    ${item.questionKo ? `<div class="mt-3 rounded-lg bg-white px-3 py-2 text-sm bnFont"><span class="font-semibold">(ক)</span> ${formatFractions(item.questionKo)}</div>` : ''}
                    ${item.questionKho ? `<div class="mt-2 rounded-lg bg-white px-3 py-2 text-sm bnFont"><span class="font-semibold">(খ)</span> ${formatFractions(item.questionKho)}</div>` : ''}
                </article>
            `).join('')}
        </section>
    `;
}

function updateReport() {
    const pool = getPoolForSelection();
    const requested = getRequestedCounts();
    const chapterGroups = splitSelectedChapters();
    const report = document.getElementById('qmReport');
    report.innerHTML = `
        <div>Selected Class: ${selectedClass || '-'}</div>
        <div>Selected Chapters: ${getSelectedChapters().length}</div>
        <div>Regular Chapters: ${chapterGroups.regular.length} | Geometry Chapters: ${chapterGroups.geometry.length}</div>
        <div>Full Mark: ${selectedFullMark}</div>
        <div>Hardness Mix: ${selectedHardness}</div>
        <div>Available: MCQ ${pool.mcq.length}, Blank ${pool.blanks.length}, Short ${pool.shorts.length}, Word ${pool.words.length}, Geometry ${pool.geometry.length}</div>
        <div>Requested: MCQ ${requested.mcq}, Blank ${requested.blanks}, Short ${requested.shorts}, Word ${requested.words}, Geometry ${requested.geometry}</div>
        <div>Coverage: MCQ and Word use regular chapters. Geometry uses only geometry chapter word problems.</div>
    `;
}

async function loadData() {
    const response = await fetch('notes-data.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load notes-data.json');
    notesData = await response.json();
}

function generatePaper() {
    const chapterGroups = splitSelectedChapters();
    const requested = getRequestedCounts();
    const generated = {
        mcq: pickChapterCovered(chapterGroups.regular, 'mcq', requested.mcq, true),
        blanks: pickChapterCovered(chapterGroups.regular, 'blanks', requested.blanks, false),
        shorts: pickChapterCovered(chapterGroups.regular, 'shorts', requested.shorts, false),
        words: pickChapterCovered(chapterGroups.regular, 'words', requested.words, true),
        geometry: pickChapterCovered(chapterGroups.geometry, 'geometry', requested.geometry, true)
    };

    document.getElementById('qmOutput').innerHTML = `
        <section class="bg-white p-4 rounded-xl shadow">
            <div class="text-2xl font-bold">Generated Question Paper</div>
            <div class="mt-2 text-slate-600">Class ${selectedClass || '-'} | Chapters ${getSelectedChapters().join(', ') || '-'} | Full Mark ${selectedFullMark} | ${selectedHardness} Mix</div>
        </section>
        ${renderGeneratedSection('MCQ', generated.mcq, 'MCQ')}
        ${renderGeneratedSection('Blank', generated.blanks, 'Blank')}
        ${renderGeneratedSection('Short', generated.shorts, 'Short')}
        ${renderGeneratedSection('Word', generated.words, 'Word')}
        ${renderGeneratedSection('Geometry', generated.geometry, 'Geometry')}
    `;

    showBanner('Question paper generated!');
}

document.getElementById('toggleAllChaptersBtn').addEventListener('click', () => {
    const boxes = [...document.querySelectorAll('#qmChapterList input[type=\"checkbox\"]')];
    const shouldCheck = boxes.some(box => !box.checked);
    boxes.forEach(box => {
        box.checked = shouldCheck;
    });
    updateReport();
});

document.getElementById('qmChapterList').addEventListener('change', updateReport);
['countMcq', 'countBlanks', 'countShorts', 'countWords', 'countGeometry'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateReport);
});
document.getElementById('generatePaperBtn').addEventListener('click', () => runAction(document.getElementById('generatePaperBtn'), 'Generating...', async () => {
    generatePaper();
}));

window.selectClass = selectClass;
window.selectPaperHardness = selectPaperHardness;
window.selectFullMark = selectFullMark;

window.onload = async () => {
    try {
        await loadData();
        renderClassSelectors();
        renderHardnessSelectors();
        renderFullMarkSelectors();
        applyCountPreset();
        renderChapterList();
    } catch (error) {
        console.error(error);
        showBanner(error.message || 'Failed to load question maker data.');
    }
};
