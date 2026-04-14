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

const SECTION_MARKS_CONFIG = {
    100: {
        mcq: { perMark: 1, count: 20, total: 20 },
        blanks: { perMark: 1, count: 10, total: 10 },
        shorts: { perMark: 2, count: 10, total: 20 },
        words: { perMark: 5, count: 10, total: 50 }
    },
    50: {
        mcq: { perMark: 1, count: 10, total: 10 },
        blanks: { perMark: 1, count: 5, total: 5 },
        shorts: { perMark: 2, count: 5, total: 10 },
        words: { perMark: 5, count: 5, total: 25 }
    }
};

const AVAILABLE_SCHOOLS = ['পি.এন.', 'কলে', 'নজমুল', 'মমিএ', 'রাবি', 'সিরো', 'হমুমু', 'পু. লাইন্স'];
let selectedSchools = [];

const ENABLE_PUSH_ANIMATION = true;
const PUSH_ANIMATION_DURATION_MS = 5;
const PUSH_ANIMATION_DELAY_MS = 5;
const A4_PAGE_COUNT = 4;
const A4_GRID_DISPLAY_ORDER = [1, 2, 3, 0]; // Visual layout: 4 1 / 2 3

const HARDNESS_PROFILES = {
    Easy: { Easy: 0.6, Medium: 0.1, Hard: 0.3 },
    Medium: { Easy: 0.1, Medium: 0.6, Hard: 0.3 },
    Hard: { Easy: 0.1, Medium: 0.2, Hard: 0.7 }
};

let notesData = { chapters: [] };
let selectedClass = '';
let selectedHardness = 'Hard';
let selectedFullMark = '100';
let examDate = null;
let schoolName = null;
let sections = null;
let examYear = null;
let currentGeneratedPaper = null;

function renderSchoolSelector() {
    const host = document.getElementById('schoolSelectorHost');
    if (!host) return;

    // The heading showing the "+" combined string
    const headingText = selectedSchools.length > 0 ? selectedSchools.join('+') : 'None selected';

    host.innerHTML = `
        <div class="mb-3">
            <div class="text-xs text-slate-500 mb-1">Schools</div>
            <div class="text-sm font-bold text-indigo-600 h-5">${headingText}</div>
        </div>
        <div class="flex flex-wrap gap-1">
            ${AVAILABLE_SCHOOLS.map(code => `
                <button 
                    type="button"
                    class="px-3 py-1 rounded-lg text-sm font-medium transition-all ${selectedSchools.includes(code) ? 'bg-indigo-500 text-white shadow-sm' : 'bg-slate-200 hover:bg-slate-300'}" 
                    onclick="toggleSchool('${code}')"
                >
                    ${code}
                </button>
            `).join('')}
        </div>
    `;
}

function toggleSchool(code) {
    const index = selectedSchools.indexOf(code);
    if (index === -1) {
        selectedSchools.push(code); // Add if not present
    } else {
        selectedSchools.splice(index, 1); // Remove if already present
    }
    renderSchoolSelector();
}

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

function shouldRenderQuestion(item, type, options = {}) {
    if (!item || !String(item.question || '').trim()) return false;

    if (type === 'MCQ' && options.requireMcqOptions) {
        return Array.isArray(item.options) && item.options.length > 0;
    }

    return true;
}

function getRenderableQuestions(items, type, options = {}) {
    return (items || []).filter(item => shouldRenderQuestion(item, type, options));
}

function setOutputTarget(targetId, html) {
    const qmOutput = document.getElementById('qmOutput');
    const pdfOutput = document.getElementById('pdfOutput');

    if (!qmOutput || !pdfOutput) return;

    qmOutput.classList.toggle('hidden', targetId !== 'qmOutput');
    pdfOutput.classList.toggle('hidden', targetId !== 'pdfOutput');
    document.getElementById(targetId).innerHTML = html;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function animateQuestionPush(node) {
    if (!ENABLE_PUSH_ANIMATION || !node?.animate) return Promise.resolve();

    const animation = node.animate([
        { opacity: 0, transform: 'translateY(24px) scale(0.96)', filter: 'blur(2px)' },
        { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0px)' }
    ], {
        duration: PUSH_ANIMATION_DURATION_MS,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards'
    });

    return animation.finished.catch(() => { });
}

async function appendBlockToPages(blockHtml, pages, startFromIndex = 0) {
    const template = document.createElement('template');
    template.innerHTML = blockHtml.trim();
    const node = template.content.firstElementChild;
    if (!node) return { fitted: false, pageIndex: startFromIndex };

    for (let i = startFromIndex; i < pages.length; i++) {
        const candidate = node.cloneNode(true);
        pages[i].appendChild(candidate);

        // Cascade down columns if options are too large
        candidate.querySelectorAll('.option-grid').forEach(grid => {
            const firstOpt = grid.children[0];
            if (!firstOpt) return;

            const lineHeight = parseFloat(window.getComputedStyle(firstOpt).lineHeight);

            // Step 1: Check if 4 columns is too narrow
            if (firstOpt.scrollHeight > lineHeight * 1.5) {
                grid.classList.remove('grid-cols-4');
                grid.classList.add('grid-cols-2');

                // Step 2: The DOM updates instantly. Check if 2 columns is STILL too narrow
                if (firstOpt.scrollHeight > lineHeight * 1.5) {
                    grid.classList.remove('grid-cols-2');
                    grid.classList.add('grid-cols-1');
                }
            }
        });

        if (pages[i].scrollHeight <= pages[i].clientHeight) {
            await animateQuestionPush(candidate);
            if (ENABLE_PUSH_ANIMATION) {
                await sleep(PUSH_ANIMATION_DELAY_MS);
            }
            return { fitted: true, pageIndex: i };
        }

        candidate.remove();
    }

    return { fitted: false, pageIndex: startFromIndex };
}

function buildAFourPages() {
    return `
        <section class="w-[297mm] h-[420mm] grid grid-cols-2 border-2 border-cyan-400">
            ${Array.from({ length: A4_PAGE_COUNT }, (_, index) => `
                <div class="mx-auto w-[148mm] h-[210mm] p-8 px-9 border-1 bg-white overflow-hidden" style="order: ${A4_GRID_DISPLAY_ORDER[index]}">
                    <div class="a4-page-content h-full border-1 border-red-400 bnFont" data-page-index="${index}"></div>
                </div>
            `).join('')}
        </section>
    `;
}

function buildAFourPageHeader() {
    return `
        <div>
            <div class="w-120 h-46 mx-auto border-3 p-[3px]">
            <div class="w-full h-full mx-auto border-6 p-[3px]">
                <div class="w-full h-full mx-auto grid grid-cols-60 grid-rows-20 border-3 p-[3px] bnFont">

                    <img class="col-start-1 row-start-1 col-end-10 row-end-7 text-center leading-none"
                        src="./Assets/Logo.png" alt="">
                    <img class="col-start-10 row-start-1 col-end-61 row-end-5 pl-2" src="./Assets/Name.png" alt="">

                    <div class="pl-1 col-start-1 row-start-14 col-end-20 row-end-18 cursor-pointer hover:bg-red-300 rounded-sm overflow-hidden" onclick="editDate(this)" title="Click to edit">
                        <p class="mr-1">
                            ${applySpecialMathFont('তারিখ: ')}<span>${englishToBanglaNumber(getExamDate())}</span>
                        </p>
                    </div>
                    <div class="pl-1 col-start-1 row-start-18 col-end-20 row-end-20">
                        <p>${applySpecialMathFont('সময়:')} ${getExamTime()}</p>
                    </div>

                    <div class="col-start-18 row-start-9 col-end-46 row-end-19 text-center leading-none">
                        <p class="text-xl font-semibold cursor-pointer hover:bg-red-300 rounded-sm" onclick="editExamYear(this)" title="Click to edit">প্রস্তুতিমূলক পরীক্ষা — <span class="year-text">${englishToBanglaNumber(getExamYear())}</span></p>
                        <p class="text-lg">${applySpecialMathFont('বিষয়:')}  প্রাথমিক গণিত</p>
                        <p>${applySpecialMathFont('শ্রেণি:')} ${getClassName()}</p>
                    </div>

                    <div
                        class="col-start-45 row-start-9 col-end-61 row-end-15 text-right pr-1 leading-none flex flex-col justify-center items-end cursor-pointer hover:bg-red-300 rounded-sm overflow-hidden" onclick="editSchoolName(this)" title="Click to edit">
                        <p class="text-xs">${getSchoolName()}</p>
                    </div>

                    <div class="col-start-45 row-start-15 col-end-61 row-end-18 text-right pr-1 leading-none cursor-pointer hover:bg-red-300 rounded-sm overflow-hidden" onclick="editSections(this)" title="Click to edit">
                        <p>অ- ${englishToBanglaNumber(getSections())}</p>
                    </div>

                    <div class="col-start-45 row-start-18 col-end-61 row-end-21 text-right pr-1 leading-none">
                        <p class="font-semibold">${applySpecialMathFont('পূর্ণমান:')} ${getFullMark()}</p>
                    </div>
                </div>
            </div> 
        </div> 
        <p class="text-center font-bold">ডানপাশের সংখ্যা পূর্ণমান জ্ঞাপক</p>
        </div>
          
    `;
}

function buildAFourSectionTitle(title, type) {
    const marks = SECTION_MARKS_CONFIG[selectedFullMark]?.[type];
    const marksText = marks
        ? `${englishToBanglaNumber(marks.perMark)}×${englishToBanglaNumber(marks.count)} = ${englishToBanglaNumber(marks.total)}`
        : '';

    const alignment = marksText ? 'justify-between' : 'justify-center';

    return `<div class="flex ${alignment} text-sm font-semibold bnFont mt-2 mb-1">
        <span>${applySpecialMathFont(title)}</span>
        ${marksText ? `<span>${marksText}</span>` : ''}
    </div>`;
}
function applySpecialMathFont(html) {
    return html.split(/(<[^>]+>)/g).map(part => {
        if (!part.startsWith('<')) {
            return part.replace(/([():.])/g, '<span class="math-sym-font">$1</span>');
        }
        return part;
    }).join('');
}

function buildAFourQuestionItem(item, index) {
    return `
        <div class="flex leading-none mb-[3px]">
            <div class="bnFont w-6 shrink-0 ml-3 ${hasFraction(item.question) ? 'pt-2' : ''}">${englishToBanglaNumber(index)}<span class="math-sym-font">.</span></div>
            <div class="w-full bnFont">
                <div>${applySpecialMathFont(formatFractions(item.question || ''))}</div>
                ${Array.isArray(item.options) && item.options.length ? `
                    <div class="mt-1 grid grid-cols-4 gap-1 bnFont ${getOptionTextSize(item.options)} break-words option-grid">
                        ${item.options.map(option => `
                            <div class="break-words">
                                <span>${escapeHtml(option.key || '')}<span class="math-sym-font">)</span></span>
                                <span>${applySpecialMathFont(formatFractions(option.text || ''))}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                ${item.questionKo ? `<div class="mt-1 bnFont"><span>ক<span class="math-sym-font">)</span></span> ${applySpecialMathFont(formatFractions(item.questionKo))}</div>` : ''}
                ${item.questionKho ? `<div class="mt-1 bnFont"><span>খ<span class="math-sym-font">)</span></span> ${applySpecialMathFont(formatFractions(item.questionKho))}</div>` : ''}
            </div>
        </div>
    `;
}

async function generatePaperAFour(paperToFormat = null) {
    // Use the saved questions if provided, otherwise fallback (shouldn't happen with new flow)
    let generated = paperToFormat;

    if (!generated) {
        const chapterGroups = splitSelectedChapters();
        const requested = getRequestedCounts();

        const geomMCQ = pickChapterCovered(chapterGroups.geometry, 'mcq', 1, true);
        const geomBlank = pickChapterCovered(chapterGroups.geometry, 'blanks', 1, true);
        const geomShort = pickChapterCovered(chapterGroups.geometry, 'shorts', 1, true);

        const adjustedRequested = {
            mcq: Math.max(0, requested.mcq - geomMCQ.length),
            blanks: Math.max(0, requested.blanks - geomBlank.length),
            shorts: Math.max(0, requested.shorts - geomShort.length),
            words: requested.words,
            geometry: Math.max(0, requested.geometry)
        };

        generated = {
            mcq: [...pickChapterCovered(chapterGroups.regular, 'mcq', adjustedRequested.mcq, true), ...geomMCQ],
            blanks: [...pickChapterCovered(chapterGroups.regular, 'blanks', adjustedRequested.blanks, false), ...geomBlank],
            shorts: [...pickChapterCovered(chapterGroups.regular, 'shorts', adjustedRequested.shorts, false), ...geomShort],
            words: pickChapterCovered(chapterGroups.regular, 'words', adjustedRequested.words, true),
            geometry: pickChapterCovered(chapterGroups.geometry, 'geometry', adjustedRequested.geometry, true)
        };
        currentGeneratedPaper = generated;
    }

    setOutputTarget('pdfOutput', buildAFourPages());

    const pages = [...document.querySelectorAll('.a4-page-content')];

    // Insert header into first page (no animation)
    const headerTemplate = document.createElement('template');
    headerTemplate.innerHTML = buildAFourPageHeader().trim();
    if (headerTemplate.content.firstElementChild) {
        pages[0].appendChild(headerTemplate.content.firstElementChild);
    }

    // Collect all question blocks in order
    const blocks = [];

    const mcqRenderable = getRenderableQuestions(generated.mcq, 'MCQ', { requireMcqOptions: true });
    if (mcqRenderable.length) {
        blocks.push(buildAFourSectionTitle('১. বহুনির্বাচনী প্রশ্ন (সঠিক উত্তরটি খাতায় লিখ):', 'mcq'));
        mcqRenderable.forEach((item, i) => blocks.push(buildAFourQuestionItem(item, i + 1)));
    }

    const blankRenderable = getRenderableQuestions(generated.blanks, 'Blank');
    if (blankRenderable.length) {
        blocks.push(buildAFourSectionTitle('২. শূন্যস্থান পূরণ কর:', 'blanks'));
        blankRenderable.forEach((item, i) => blocks.push(buildAFourQuestionItem(item, i + 1)));
    }

    const shortCount = SECTION_MARKS_CONFIG[selectedFullMark]?.shorts?.count || 0;
    const shortRenderable = getRenderableQuestions(generated.shorts, 'Short');
    if (shortRenderable.length) {
        blocks.push(buildAFourSectionTitle(`৩. সংক্ষেপে উত্তর দাও (যেকোনো ${englishToBanglaNumber(shortCount)} টি):`, 'shorts'));
        shortRenderable.forEach((item, i) => blocks.push(buildAFourQuestionItem(item, i + 1)));
    }

    const wordCount = SECTION_MARKS_CONFIG[selectedFullMark]?.words?.count || 0;
    const wordRenderable = getRenderableQuestions(generated.words, 'Word');

    let continuousIndex = 1;

    if (wordRenderable.length) {
        blocks.push(buildAFourSectionTitle(`৪. জ্যামিতি অংশ হতে কমপক্ষে ১টি সহ যেকোনো ${englishToBanglaNumber(wordCount)}টি প্রশ্নের উত্তর দাও:`, 'words'));
        wordRenderable.forEach((item) => {
            blocks.push(buildAFourQuestionItem(item, continuousIndex++));
        });
    }

    const geomRenderable = getRenderableQuestions(generated.geometry, 'Geometry');
    if (geomRenderable.length) {
        blocks.push(buildAFourSectionTitle('জ্যামিতি'));
        geomRenderable.forEach((item) => {
            blocks.push(buildAFourQuestionItem(item, continuousIndex++));
        });
    }

    let currentPageIndex = 0;

    for (const html of blocks) {
        const result = await appendBlockToPages(html, pages, currentPageIndex);
        if (!result.fitted) break;
        currentPageIndex = result.pageIndex;
    }

    showBanner('A4 Formatted!');
}

function renderGeneratedSection(title, items, type, options = {}) {
    const renderableItems = getRenderableQuestions(items, type, options);
    if (!renderableItems.length) return '';
    return `
        <section class="bg-white p-4 rounded-xl shadow space-y-3">
            <div class="text-lg font-bold">${title} (${renderableItems.length})</div>
            ${renderableItems.map((item, index) => `
                <article class="rounded-lg bg-slate-50 p-3">
                    <div class="mb-1 text-xs uppercase text-slate-500">#${index + 1} | ${type} | ${item.hardness || 'Easy'} | Chapter ${item.chapter || '-'}</div>
                    <div class="bnFont font-semibold">${applySpecialMathFont(formatFractions(item.question || ''))}</div>
                    ${Array.isArray(item.options) && item.options.length ? `
                        <div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 bnFont">
                            ${item.options.map(option => `
                                <div class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                                    <span class="font-semibold">${escapeHtml(option.key || '')}<span class="math-sym-font">)</span></span>
                                    <span>${applySpecialMathFont(formatFractions(option.text || ''))}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${item.questionKo ? `<div class="mt-3 rounded-lg bg-white px-3 py-2 text-sm bnFont"><span class="font-semibold">(ক<span class="math-sym-font">)</span></span> ${applySpecialMathFont(formatFractions(item.questionKo))}</div>` : ''}
                    ${item.questionKho ? `<div class="mt-2 rounded-lg bg-white px-3 py-2 text-sm bnFont"><span class="font-semibold">(খ<span class="math-sym-font">)</span></span> ${applySpecialMathFont(formatFractions(item.questionKho))}</div>` : ''}
                </article>
            `).join('')}
        </section>
    `;
}

function englishToBanglaNumber(value) {
    return String(value || '').replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
}

function getOptionTextSize(options) {
    if (!Array.isArray(options) || !options.length) return 'text-sm';
    const maxLength = Math.max(...options.map(o => String(o.text || '').length));
    if (maxLength > 40) return 'text-xs';
    if (maxLength > 20) return 'text-sm';
    return 'text-base';
}

function hasFraction(text) {
    return /(\/|fraction)/.test(String(text || ''));
}

function getExamDate() {
    if (examDate) return examDate;
    return new Date(Date.now() + 864e5).toISOString().split('T')[0].split('-').reverse().join('-');
}

function getSchoolName() {
    // If manually edited, just return it (break-words in HTML handles long manual typing)
    if (schoolName) return schoolName;

    if (selectedSchools.length === 0) return '';

    // If 3 or fewer, keep on one line
    if (selectedSchools.length <= 3) {
        return selectedSchools.join('+');
    }

    // If MORE than 3, split into two lines exactly after the 3rd item
    const line1 = selectedSchools.slice(0, 3).join('+');
    const line2 = selectedSchools.slice(3).join('+');

    return `${line1}<br>${line2}`;
}

function getSections() {
    return sections || '3, 4';
}

function getClassName() {
    const classMap = {
        '3': 'তৃতীয়',
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
        if (e.key === 'Enter') saveDate();
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
        if (e.key === 'Enter') save();
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
        if (e.key === 'Enter') save();
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
        if (e.key === 'Enter') save();
    });
    input.addEventListener('blur', save);
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
    if (item.type === 'mcq' && item.options) {
        const correct = item.options.find(o => o.isCorrect);
        if (correct) return `${correct.key}) ${correct.text}`;
    }

    if ((item.type === 'blanks' || item.type === 'short') && item.answer) {
        return item.answer;
    }

    if (item.type === 'word_problem') {
        const answers = [];

        if (item.solutionKo) {
            const lines = item.solutionKo.split('\n');
            const ansLine = lines.reverse().find(line => line.trim().startsWith('উত্তর'));
            if (ansLine) answers.push(`(ক) ${ansLine.replace('উত্তর:', '').trim()}`);
        }

        if (item.solutionKho) {
            const lines = item.solutionKho.split('\n');
            const ansLine = lines.reverse().find(line => line.trim().startsWith('উত্তর'));
            if (ansLine) answers.push(`(খ) ${ansLine.replace('উত্তর:', '').trim()}`);
        }

        if (!answers.length && item.solution) {
            const lines = item.solution.split('\n');
            const ansLine = lines.reverse().find(line => line.trim().startsWith('উত্তর'));
            if (ansLine) answers.push(ansLine.replace('উত্তর:', '').trim());
        }

        return answers.join(' | ') || '—';
    }

    return '—';
}

function updateReport() {
    const pool = getPoolForSelection();
    const chapterGroups = splitSelectedChapters();
    const report = document.getElementById('qmReport');
    report.innerHTML = `
        <div><span class="font-semibold">Selected Chapters: </span>${getSelectedChapters().length}: Regular: ${chapterGroups.regular.length} | Geometry: ${chapterGroups.geometry.length}</div>
        <div><span class="font-semibold">Available: </span>MCQ ${pool.mcq.length}, Blank ${pool.blanks.length}, Short ${pool.shorts.length}, Word ${pool.words.length}, Geometry ${pool.geometry.length}</div>
    `;
}

async function loadData() {
    const response = await fetch('notes-data.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load notes-data.json');
    notesData = await response.json();
}

function generatePaper() {
    // CLEAR previous formatted data
    const pdfOutput = document.getElementById('pdfOutput');
    pdfOutput.innerHTML = '';
    currentGeneratedPaper = null; // Reset saved paper
    schoolName = null; // Reset manual school name edits back to selector

    const chapterGroups = splitSelectedChapters();
    const requested = getRequestedCounts();

    const geomMCQ = pickChapterCovered(chapterGroups.geometry, 'mcq', 1, true);
    const geomBlank = pickChapterCovered(chapterGroups.geometry, 'blanks', 1, true);
    const geomShort = pickChapterCovered(chapterGroups.geometry, 'shorts', 1, true);

    const adjustedRequested = {
        mcq: Math.max(0, requested.mcq - geomMCQ.length),
        blanks: Math.max(0, requested.blanks - geomBlank.length),
        shorts: Math.max(0, requested.shorts - geomShort.length),
        words: requested.words,
        geometry: Math.max(0, requested.geometry)
    };

    const generated = {
        mcq: [...pickChapterCovered(chapterGroups.regular, 'mcq', adjustedRequested.mcq, true), ...geomMCQ],
        blanks: [...pickChapterCovered(chapterGroups.regular, 'blanks', adjustedRequested.blanks, false), ...geomBlank],
        shorts: [...pickChapterCovered(chapterGroups.regular, 'shorts', adjustedRequested.shorts, false), ...geomShort],
        words: pickChapterCovered(chapterGroups.regular, 'words', adjustedRequested.words, true),
        geometry: pickChapterCovered(chapterGroups.geometry, 'geometry', adjustedRequested.geometry, true)
    };

    // SAVE THE EXACT QUESTIONS SO FORMAT DOESN'T RANDOMIZE THEM
    currentGeneratedPaper = generated;

    setOutputTarget('qmOutput', `
    <section class="bg-white p-4 rounded-xl shadow">
        <div class="text-2xl text-red-500 font-bold">Generated Question Paper</div>
        <div class="mt-2 text-slate-600">
            Class ${selectedClass || '-'} |
            Chapters ${getSelectedChapters().join(', ') || '-'} |
            Full Mark ${selectedFullMark} |
            ${selectedHardness} Mix
        </div>
    </section>
    ${renderGeneratedSection('MCQ', generated.mcq, 'MCQ', { requireMcqOptions: true })}
    ${renderGeneratedSection('Blank', generated.blanks, 'Blank')}
    ${renderGeneratedSection('Short', generated.shorts, 'Short')}
    ${renderGeneratedSection('Word', generated.words, 'Word')}
    ${renderGeneratedSection('Geometry', generated.geometry, 'Geometry')}
    ${renderAnswerBox(generated)}
`);

    // Button states
    document.getElementById('formatPdfBtn').disabled = false;
    document.getElementById('downloadPdfBtn').disabled = true;

    showBanner('Question paper generated!');
}

function downloadPdf() {
    const pdfOutput = document.getElementById('pdfOutput');
    if (!pdfOutput || pdfOutput.classList.contains('hidden')) {
        showBanner('Please format the paper first!');
        return;
    }

    // Get the outer grid wrapper (the whole 2x2 layout)
    const gridWrapper = pdfOutput.querySelector('section');

    if (!gridWrapper) {
        showBanner('No layout to download!');
        return;
    }

    const printWindow = window.open('', '_blank');

    // Copy all active stylesheets (Tailwind, custom fonts, etc) to the new window
    const styles = Array.from(document.styleSheets)
        .map(sheet => {
            try {
                return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
            } catch (e) {
                if (sheet.href) return `@import url('${sheet.href}');`;
                return '';
            }
        })
        .join('\n');

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="bn">
        <head>
            <meta charset="UTF-8">
            <title>Question Paper PDF</title>
            <style>
                ${styles}
                
                /* Force landscape orientation for the print */
                @page {
                    size: landscape;
                    margin: 0;
                }

                body {
                    margin: 0;
                    padding: 0;
                    background: white;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                }

                /* Container maintains the exact screen dimensions */
                .print-container {
                    width: 297mm;
                    height: 420mm;
                    box-sizing: border-box;
                    background: white;
                }

                /* Remove the cyan outer border */
                .print-container > section {
                    border: none !important;
                    box-shadow: none !important;
                }

                /* Remove the red borders around the page content */
                .print-container > section > div {
                    border: none !important;
                }
                
                .print-container > section > div > div {
                    border: none !important;
                }
                
                img {
                    max-width: 100%;
                    height: auto;
                }
            </style>
        </head>
        <body>
            <div class="print-container">
                ${gridWrapper.outerHTML}
            </div>
        </body>
        </html>
    `);

    printWindow.document.close();

    // Wait for images to load before triggering print
    const images = printWindow.document.querySelectorAll('img');
    let loadedCount = 0;
    const totalImages = images.length;

    function triggerPrint() {
        setTimeout(() => {
            printWindow.print();
        }, 250);
    }

    if (totalImages === 0) {
        triggerPrint();
    } else {
        images.forEach(img => {
            const checkLoad = () => {
                loadedCount++;
                if (loadedCount === totalImages) {
                    triggerPrint();
                }
            };

            if (img.complete) {
                checkLoad();
            } else {
                img.onload = checkLoad;
                img.onerror = checkLoad;
            }
        });
    }
}

document.getElementById('toggleAllChaptersBtn').addEventListener('click', () => {
    const boxes = [...document.querySelectorAll('#qmChapterList input[type="checkbox"]')];
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
    if (!currentGeneratedPaper) {
        showBanner('Please generate the paper first!');
        return;
    }

    const pdfOutput = document.getElementById('pdfOutput');
    const existingPages = pdfOutput.querySelectorAll('.a4-page-content');
    const hasContent = Array.from(existingPages).some(page => page.children.length > 0);

    if (hasContent) {
        document.getElementById('qmOutput').classList.add('hidden');
        pdfOutput.classList.remove('hidden');
    } else {
        // Pass the exact saved paper so it formats WITHOUT randomizing
        await generatePaperAFour(currentGeneratedPaper);
    }

    document.getElementById('downloadPdfBtn').disabled = false;
}));
document.getElementById('downloadPdfBtn').addEventListener('click', () => runAction(document.getElementById('downloadPdfBtn'), 'Preparing PDF...', async () => {
    downloadPdf();
}));


window.selectClass = selectClass;
window.selectPaperHardness = selectPaperHardness;
window.selectFullMark = selectFullMark;
window.toggleSchool = toggleSchool;

window.onload = async () => {
    try {
        await loadData();
        renderClassSelectors();
        renderSchoolSelector();
        renderHardnessSelectors();
        renderFullMarkSelectors();
        applyCountPreset();
        renderChapterList();

        // Initialize button states
        document.getElementById('formatPdfBtn').disabled = true;
        document.getElementById('downloadPdfBtn').disabled = true;

    } catch (error) {
        console.error(error);
        showBanner(error.message || 'Failed to load question maker data.');
    }
};