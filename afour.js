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
let selectedFullMark = '50';
let examDate = null;
let schoolName = null;
let sections = null;
let examYear = null;

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
        <label class="flex items-start gap-1 rounded-sm bg-white px-3 py-1">
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
                    ${item.questionKo ? `<div class="mt-3 rounded-lg bg-white px-3 py-2 text-sm bnFont"><span class="font-semibold">(ক)</span> ${formatFractions(item.questionKo)}</div>` : ''}
                    ${item.questionKho ? `<div class="mt-2 rounded-lg bg-white px-3 py-2 text-sm bnFont"><span class="font-semibold">(খ)</span> ${formatFractions(item.questionKho)}</div>` : ''}
                </article>
            `).join('')}
        </section>
    `;
}

function englishToBanglaNumber(value) {
    return String(value || '').replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
}
function getOptionGridCols(options) {
    if (!Array.isArray(options) || !options.length) return 'grid-cols-4';
    const maxLength = Math.max(...options.map(o => String(o.text || '').length));
    return maxLength > 15 ? 'grid-cols-2' : 'grid-cols-4';
}

function getOptionTextSize(options) {
    if (!Array.isArray(options) || !options.length) return 'text-sm';
    const maxLength = Math.max(...options.map(o => String(o.text || '').length));
    if (maxLength > 40) return 'text-xs';
    if (maxLength > 20) return 'text-sm';
    return 'text-base';
} function hasFraction(text) {
    return /(\/|fraction)/.test(String(text || ''));
}

function getExamDate() {
    if (examDate) return examDate;
    return new Date(Date.now() + 864e5).toISOString().split('T')[0].split('-').reverse().join('-');
}

function getSchoolName() {
    return schoolName || 'পি.এন.';
}

function getSections() {
    return sections || '3, 4';
}

function getClassName() {
    const classMap = {
        '3': 'তৃতীয়',
        '4': 'চতুর্থ',
        '5': 'পঞ্চম',
        '6': 'ষষ্ঠ',
        '7': 'সপ্তম'
    };
    return classMap[String(selectedClass)] || 'চতুর্থ';
}

function getExamTime() {
    if (selectedFullMark === '100') {
        return '২ ঘণ্টা ৩০ মিনিট';
    } else {
        return '১ ঘণ্টা ৩০ মিনিট';
    }
}

function getFullMark() {
    return englishToBanglaNumber(selectedFullMark);
}

function getExamYear() {
    if (examYear) return examYear;
    return String(new Date().getFullYear());
}

function editDate(container) {
    const span = container.querySelector('span');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getExamDate();
    input.classList.add('w-20', 'h-full', 'editing', 'border-2', 'px-1', 'text-xs');
    span.replaceWith(input);
    input.focus();
    input.select();

    const saveDate = () => {
        if (input.value.trim()) {
            examDate = input.value.trim();
            const newSpan = document.createElement('span');
            newSpan.textContent = englishToBanglaNumber(examDate);
            input.replaceWith(newSpan);
            showBanner('Date updated!');
        }
    };

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            saveDate();
        }
    });

    input.addEventListener('blur', saveDate);
}

function editSchoolName(container) {
    const p = container.querySelector('p');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getSchoolName();
    input.classList.add('w-full', 'h-full', 'editing', 'border-2', 'px-1', 'text-sm');
    p.replaceWith(input);
    input.focus();
    input.select();

    const save = () => {
        if (input.value.trim()) {
            schoolName = input.value.trim();
            const newP = document.createElement('p');
            newP.classList.add('text-sm');
            newP.textContent = schoolName;
            input.replaceWith(newP);
            showBanner('School name updated!');
        }
    };

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            save();
        }
    });

    input.addEventListener('blur', save);
}

function editSections(container) {
    const p = container.querySelector('p');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getSections();
    input.classList.add('w-full', 'h-full', 'editing', 'border-2', 'px-1');
    p.replaceWith(input);
    input.focus();
    input.select();

    const save = () => {
        if (input.value.trim()) {
            sections = input.value.trim();
            const newP = document.createElement('p');
            newP.textContent = 'অ- ' + englishToBanglaNumber(sections);
            input.replaceWith(newP);
            showBanner('Sections updated!');
        }
    };

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            save();
        }
    });

    input.addEventListener('blur', save);
}

function editExamYear(pElement) {
    const span = pElement.querySelector('span.year-text');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = getExamYear();
    input.classList.add('w-10', 'h-full', 'editing', 'border-2', 'px-1', 'text-sm');
    span.replaceWith(input);
    input.focus();
    input.select();

    const save = () => {
        if (input.value.trim()) {
            examYear = input.value.trim();
            const newSpan = document.createElement('span');
            newSpan.classList.add('year-text');
            newSpan.textContent = englishToBanglaNumber(examYear);
            input.replaceWith(newSpan);
            showBanner('Year updated!');
        }
    };

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            save();
        }
    });

    input.addEventListener('blur', save);
}
function renderGeneratedSectionAFour(title, items, type) {
    if (!items.length) return '';
    return `
        <section class="w-112 bg-yellow-200 p-4 rounded-xl shadow space-y-1 leading-none">
            <div class="text-lg font-bold bnFont">${title}</div>
            <div class="pl-2">
                ${items.map((item, index) => `
                    <article>
                        <div class="w-full flex">
                            <div class="bnFont w-7 ${hasFraction(item.question) ? 'pt-2' : ''}">${englishToBanglaNumber(index + 1)}.</div>
                            <div class="w-full bnFont bg-orange-400">${formatFractions(item.question || '')}
                            ${Array.isArray(item.options) && item.options.length ? `
                                <div class="grid ${getOptionGridCols(item.options)} gap-2 bnFont ${getOptionTextSize(item.options)} break-words">
                                    ${item.options.map(option => `
                                        <div class="break-words">
                                            <span>${escapeHtml(option.key || '')})</span>
                                            <span>${formatFractions(option.text || '')}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : ''}
                            ${item.questionKo ? `<div class="bnFont"><span>ক)</span> ${formatFractions(item.questionKo)}</div>` : ''}
                            ${item.questionKho ? `<div class="bnFont"><span>খ)</span> ${formatFractions(item.questionKho)}</div>` : ''}
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
        </section>
    `;
}

function renderAnswerBox(generated) {

    function render(type, items) {
        if (!items.length) return '';

        return `
            <div class="bg-white p-4 rounded-xl shadow">
                <div class="font-bold text-lg mb-2">${type}</div>
                ${items.map((item, i) => `
                    <div class="text-sm flex gap-2">
                        <span class="font-semibold">${i + 1}.</span>
                        <span>${formatFractions(getAnswer(item) || '—')}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    return `
        <section class="bg-green-100 border-2 border-green-400 p-4 rounded-xl space-y-4">
            <div class="text-xl font-bold text-green-800">Answer Sheet</div>

            ${render('MCQ', generated.mcq)}
            ${render('Blanks', generated.blanks)}
            ${render('Short', generated.shorts)}
            ${render('Word', generated.words)}
            ${render('Geometry', generated.geometry)}
        </section>
    `;
}
function getAnswer(item) {
    // MCQ
    if (item.type === 'mcq' && item.options) {
        const correct = item.options.find(o => o.isCorrect);
        if (correct) return `${correct.key}) ${correct.text}`;
    }

    // Blanks or Shorts
    if ((item.type === 'blanks' || item.type === 'short') && item.answer) {
        return item.answer;
    }

    // Word problem
    if (item.type === 'word_problem') {
        const answers = [];

        // Ko part
        if (item.solutionKo) {
            const lines = item.solutionKo.split('\n');
            const ansLine = lines.reverse().find(line => line.trim().startsWith('উত্তর'));
            if (ansLine) answers.push(`(ক) ${ansLine.replace('উত্তর:', '').trim()}`);
        }

        // Kho part
        if (item.solutionKho) {
            const lines = item.solutionKho.split('\n');
            const ansLine = lines.reverse().find(line => line.trim().startsWith('উত্তর'));
            if (ansLine) answers.push(`(খ) ${ansLine.replace('উত্তর:', '').trim()}`);
        }

        // Fallback to single solution field
        if (!answers.length && item.solution) {
            const lines = item.solution.split('\n');
            const ansLine = lines.reverse().find(line => line.trim().startsWith('উত্তর'));
            if (ansLine) answers.push(ansLine.replace('উত্তর:', '').trim());
        }

        return answers.join(' | ') || '—';
    }

    return '—'; // fallback if no answer found
}
function updateReport() {
    const pool = getPoolForSelection();
    const requested = getRequestedCounts();
    const chapterGroups = splitSelectedChapters();
    const report = document.getElementById('qmReport');
    report.innerHTML = `
        <div><span class="font-semibold">Selected Chapters: </span>${getSelectedChapters().length}: Regular: ${chapterGroups.regular.length} | Geometry: ${chapterGroups.geometry.length}</div>
        <div><span class="font-semibold">Available: </span>MCQ ${pool.mcq.length}, Blank ${pool.blanks.length}, Short ${pool.shorts.length}, Word ${pool.words.length}, Geometry ${pool.geometry.length}</div>
    `;
}

// Requested part from report function
// <div><span class="font-semibold">Requested: </span>MCQ ${requested.mcq}, Blank ${requested.blanks}, Short ${requested.shorts}, Word ${requested.words}, Geometry ${requested.geometry}</div>



async function loadData() {
    const response = await fetch('notes-data.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load notes-data.json');
    notesData = await response.json();
}

function generatePaper() {
    const chapterGroups = splitSelectedChapters();
    const requested = getRequestedCounts();

    // Step 1: Pick 1 MCQ, 1 Blank, 1 Short from geometry chapters (if available)
    const geomMCQ = pickChapterCovered(chapterGroups.geometry, 'mcq', 1, true);
    const geomBlank = pickChapterCovered(chapterGroups.geometry, 'blanks', 1, true);
    const geomShort = pickChapterCovered(chapterGroups.geometry, 'shorts', 1, true);

    // Step 2: Adjust requested counts for regular chapters
    const adjustedRequested = {
        mcq: Math.max(0, requested.mcq - geomMCQ.length),
        blanks: Math.max(0, requested.blanks - geomBlank.length),
        shorts: Math.max(0, requested.shorts - geomShort.length),
        words: requested.words,
        geometry: Math.max(0, requested.geometry) // keep geometry words as before
    };

    // Step 3: Pick remaining questions from regular chapters
    const generated = {
        mcq: [...pickChapterCovered(chapterGroups.regular, 'mcq', adjustedRequested.mcq, true), ...geomMCQ],
        blanks: [...pickChapterCovered(chapterGroups.regular, 'blanks', adjustedRequested.blanks, false), ...geomBlank],
        shorts: [...pickChapterCovered(chapterGroups.regular, 'shorts', adjustedRequested.shorts, false), ...geomShort],
        words: pickChapterCovered(chapterGroups.regular, 'words', adjustedRequested.words, true),
        geometry: pickChapterCovered(chapterGroups.geometry, 'geometry', adjustedRequested.geometry, true)
    };

    document.getElementById('qmOutput').innerHTML = `
    <section class="bg-white p-4 rounded-xl shadow">
        
        <div class="text-2xl text-red-500 font-bold">Generated Question Paper</div>
        <div class="mt-2 text-slate-600">
            Class ${selectedClass || '-'} | 
            Chapters ${getSelectedChapters().join(', ') || '-'} | 
            Full Mark ${selectedFullMark} | 
            ${selectedHardness} Mix
        </div>
    </section>

    ${renderGeneratedSection('MCQ', generated.mcq, 'MCQ')}
    ${renderGeneratedSection('Blank', generated.blanks, 'Blank')}
    ${renderGeneratedSection('Short', generated.shorts, 'Short')}
    ${renderGeneratedSection('Word', generated.words, 'Word')}
    ${renderGeneratedSection('Geometry', generated.geometry, 'Geometry')}

    <!-- ✅ Separate Answer Box -->
    ${renderAnswerBox(generated)}
`;

    showBanner('Question paper generated!');
}

function generatePaperAFour() {
    const chapterGroups = splitSelectedChapters();
    const requested = getRequestedCounts();

    // Step 1: Pick 1 MCQ, 1 Blank, 1 Short from geometry chapters (if available)
    const geomMCQ = pickChapterCovered(chapterGroups.geometry, 'mcq', 1, true);
    const geomBlank = pickChapterCovered(chapterGroups.geometry, 'blanks', 1, true);
    const geomShort = pickChapterCovered(chapterGroups.geometry, 'shorts', 1, true);

    // Step 2: Adjust requested counts for regular chapters
    const adjustedRequested = {
        mcq: Math.max(0, requested.mcq - geomMCQ.length),
        blanks: Math.max(0, requested.blanks - geomBlank.length),
        shorts: Math.max(0, requested.shorts - geomShort.length),
        words: requested.words,
        geometry: Math.max(0, requested.geometry) // keep geometry words as before
    };

    // Step 3: Pick remaining questions from regular chapters
    const generated = {
        mcq: [...pickChapterCovered(chapterGroups.regular, 'mcq', adjustedRequested.mcq, true), ...geomMCQ],
        blanks: [...pickChapterCovered(chapterGroups.regular, 'blanks', adjustedRequested.blanks, false), ...geomBlank],
        shorts: [...pickChapterCovered(chapterGroups.regular, 'shorts', adjustedRequested.shorts, false), ...geomShort],
        words: pickChapterCovered(chapterGroups.regular, 'words', adjustedRequested.words, true),
        geometry: pickChapterCovered(chapterGroups.geometry, 'geometry', adjustedRequested.geometry, true)
    };

    document.getElementById('qmOutput').innerHTML = `
    <section class="bg-white p-4 rounded-xl shadow bnFont">
        <div class="w-112 h-42 mx-auto border-3 p-[3px]">
            <div class="w-full h-full mx-auto border-6 p-[3px]">
                <div class="w-full h-full mx-auto grid grid-cols-60 grid-rows-20 border-3 p-[3px] bnFont">

                    <img class="col-start-1 row-start-1 col-end-10 row-end-20 text-center leading-none"
                        src="./Assets/Logo.png" alt="">
                    <img class="col-start-10 row-start-1 col-end-61 row-end-5 pl-2" src="./Assets/Name.png" alt="">

                    <div class="pl-1 col-start-1 row-start-13 col-end-20 row-end-17 cursor-pointer hover:bg-red-300 rounded-sm" onclick="editDate(this)" title="Click to edit">
                        <p>
                            তারিখ: <span>${englishToBanglaNumber(getExamDate())}</span>
                        </p>
                    </div>
                    <div class="pl-1 col-start-1 row-start-17 col-end-20 row-end-21">
                        <p>সময়: ${getExamTime()}</p>
                    </div>

                    <div class="col-start-17 row-start-9 col-end-45 row-end-19 text-center leading-none">
                        <p class="text-xl font-semibold cursor-pointer hover:bg-red-300 rounded-sm" onclick="editExamYear(this)" title="Click to edit">প্রস্তুতিমূলক পরীক্ষা — <span class="year-text">${englishToBanglaNumber(getExamYear())}</span></p>
                        <p>বিষয়: প্রাথমিক গণিত</p>
                        <p>শ্রেণি: ${getClassName()}</p>
                    </div>

                    <div
                        class="col-start-45 row-start-9 col-end-61 row-end-15 text-right pr-1 leading-none flex flex-col justify-center items-end cursor-pointer hover:bg-red-300 rounded-sm" onclick="editSchoolName(this)" title="Click to edit">
                        <p class="text-sm">${getSchoolName()}</p>
                    </div>

                    <div class="col-start-45 row-start-15 col-end-61 row-end-18 text-right pr-1 leading-none cursor-pointer hover:bg-red-300 rounded-sm" onclick="editSections(this)" title="Click to edit">
                        <p>অ- ${englishToBanglaNumber(getSections())}</p>
                    </div>

                    <div class="col-start-45 row-start-18 col-end-61 row-end-21 text-right pr-1 leading-none">
                        <p class="font-semibold">পূর্ণমান: ${getFullMark()}</p>
                    </div>
                </div>
            </div>
        </div>
        <div class="text-2xl font-bold">Generated Question Paper</div>
        <div class="mt-2 text-green-600">
            Class ${selectedClass || '-'} | 
            Chapters ${getSelectedChapters().join(', ') || '-'} | 
            Full Mark ${selectedFullMark} | 
            ${selectedHardness} Mix
        </div>
    </section>

    ${renderGeneratedSectionAFour('১. বহুনির্বাচনী প্রশ্ন (সঠিক উত্তরটি খাতায় লিখ):', generated.mcq, 'MCQ')}
    ${renderGeneratedSectionAFour('২. শূন্যস্থান পূরণ কর:', generated.blanks, 'Blank')}
    ${renderGeneratedSectionAFour(`৩. সংক্ষেপে উত্তর দাও (যেকোনো ${englishToBanglaNumber(generated.shorts.length - 2)} টি):`, generated.shorts, 'Short')}
    ${renderGeneratedSectionAFour('৪. ১০ টি প্রশ্নের উত্তর দাও:', generated.words, 'Word')}
    ${renderGeneratedSectionAFour('জ্যামিতি', generated.geometry, 'Geometry')}

    <!-- ✅ Separate Answer Box: ${renderAnswerBox(generated)} -->
    
`;

    showBanner('A4 Formatted!');
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
document.getElementById('formatPdfBtn').addEventListener('click', () => runAction(document.getElementById('formatPdfBtn'), 'Formatting...', async () => {
    generatePaperAFour();
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
        generatePaperAFour(); // Generate paper in A4 format on load for quick preview
    } catch (error) {
        console.error(error);
        showBanner(error.message || 'Failed to load question maker data.');
    }
};