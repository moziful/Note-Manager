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

    const htmlOutput = `
    <section class="bg-white p-4 rounded-xl shadow">
        <div class="text-2xl font-bold">Generated Question Paper</div>
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

    document.getElementById('qmOutput').innerHTML = htmlOutput;
    lastGeneratedHtml = htmlOutput;
    isPdfFormatMode = false;

    // Show Format PDF button after generate
    document.getElementById('formatPdfBtn').classList.remove('hidden');
    showBanner('Question paper generated!');
}

// Store generated questions globally for PDF formatting
let lastGeneratedQuestions = {};
let lastGeneratedHtml = '';
let isPdfFormatMode = false;
function collectQuestionsFromOutput() {
    const sections = document.querySelectorAll('#qmOutput section');
    const collected = {
        mcq: [],
        blanks: [],
        shorts: [],
        words: [],
        geometry: [],
        metadata: {}
    };

    sections.forEach(section => {
        const title = section.querySelector('.text-lg, .text-2xl, .text-xl');
        const articles = section.querySelectorAll('article');

        if (!title) return; // Skip if no title (like metadata section)

        const titleText = title.textContent.toLowerCase();

        articles.forEach((article, index) => {
            const questionText = article.querySelector('.bnFont');
            const header = article.querySelector('.text-xs.uppercase');

            if (questionText) {
                const item = {
                    index: index + 1,
                    sectionType: titleText,
                    question: questionText.innerHTML,
                    header: header ? header.textContent : '',
                    html: article.innerHTML
                };

                if (titleText.includes('mcq')) collected.mcq.push(item);
                else if (titleText.includes('blank')) collected.blanks.push(item);
                else if (titleText.includes('short')) collected.shorts.push(item);
                else if (titleText.includes('word')) collected.words.push(item);
                else if (titleText.includes('geometry')) collected.geometry.push(item);
            }
        });
    });

    return collected;
}

// Render question item for A4 layout
function renderA4QuestionItem(item) {
    return `
        <div class="a4-question-item">
            <div class="question-header">${escapeHtml(item.header)}</div>
            <div class="question-text">${item.question}</div>
        </div>
    `;
}

// Distribute questions into A4 pages following the pattern:
// Single page: Left → Right
// Two pages: Page1 Right → Page2 Left → Page2 Right → Page1 Left
function distributeQuestionsToPages(allQuestions) {
    const totalQuestions = allQuestions.length;

    // Determine if we need 1 or 2 pages based on estimated space
    // Assuming ~6-8 questions per column in A4 landscape
    const need2Pages = totalQuestions > 12;

    if (!need2Pages) {
        // Single page: arrange in 2 columns (left first, then right)
        const mid = Math.ceil(totalQuestions / 2);
        return [{
            columns: [
                allQuestions.slice(0, mid),
                allQuestions.slice(mid)
            ]
        }];
    } else {
        // Two pages with specific flow pattern:
        // Flow order: Page1Right → Page2Left → Page2Right → Page1Left
        // Visual layout (what user sees when printing):
        // Page 1: [Left (empty/reserved), Right (questions)]
        // Page 2: [Left (questions), Right (questions)]

        // Divide questions into 4 roughly equal parts
        const quarterSize = Math.ceil(totalQuestions / 4);

        const page1Right = allQuestions.slice(0, quarterSize);
        const page2Left = allQuestions.slice(quarterSize, quarterSize * 2);
        const page2Right = allQuestions.slice(quarterSize * 2, quarterSize * 3);
        const page1Left = allQuestions.slice(quarterSize * 3);

        return [
            {
                columns: [page1Left, page1Right]
            },
            {
                columns: [page2Left, page2Right]
            }
        ];
    }
}

// Generate A4 PDF Layout
function formatPdfLayout() {
    const questions = collectQuestionsFromOutput();

    // Combine all questions in order
    const allQuestions = [
        ...questions.mcq,
        ...questions.blanks,
        ...questions.shorts,
        ...questions.words,
        ...questions.geometry
    ];

    if (!allQuestions.length) {
        showBanner('No questions to format. Generate a paper first!');
        return;
    }

    const pages = distributeQuestionsToPages(allQuestions);

    let pdfHtml = '<div class="a4-pdf-container">';

    pages.forEach((page, pageIndex) => {
        pdfHtml += `<div class="a4-page" data-page="${pageIndex + 1}">`;

        page.columns.forEach((columnQuestions, colIndex) => {
            const pageNum = pageIndex + 1;
            const colName = colIndex === 0 ? 'Left' : 'Right';

            pdfHtml += '<div class="a4-column">';
            pdfHtml += `<div class="a4-page-label">Page ${pageNum} - ${colName}</div>`;

            if (columnQuestions.length === 0) {
                pdfHtml += '<div style="padding: 20px; text-align: center; color: #d1d5db;">Reserved for content</div>';
            } else {
                columnQuestions.forEach(q => {
                    pdfHtml += renderA4QuestionItem(q);
                });
            }
            pdfHtml += '</div>';
        });

        pdfHtml += '</div>';
    });

    pdfHtml += `
    <div style="margin-top: 20px; padding: 10px; text-align: center;">
        <button onclick="backToFullView()" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            Back to Full View
        </button>
        <button onclick="window.print()" class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-2">
            Print PDF
        </button>
    </div>`;

    pdfHtml += '</div>';

    // Replace output with formatted PDF view
    document.getElementById('qmOutput').innerHTML = pdfHtml;
    isPdfFormatMode = true;
    showBanner('PDF layout formatted! Ready to print.');
}

// Return to full question view
function backToFullView() {
    if (lastGeneratedHtml) {
        document.getElementById('qmOutput').innerHTML = lastGeneratedHtml;
        isPdfFormatMode = false;
        showBanner('Switched back to full view.');
    }
}

window.backToFullView = backToFullView;

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
    formatPdfLayout();
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