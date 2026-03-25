const TAGS = ['Addition', 'Subtraction', 'Division', 'Multiplication', '4 Operation', 'LCM-GCD', 'Geometry', 'Area', 'Theory', 'General'];
const STORAGE_KEY = 'noteParserProProgress';
const TYPE_LABELS = {
    mcq: 'বহুনির্বাচনী প্রশ্ন',
    blanks: 'শূন্যস্থান পূরণ',
    shorts: 'সংক্ষিপ্ত প্রশ্ন ও উত্তর',
    words: 'অনুশীলনীর প্রশ্ন ও সমাধান'
};

let questionToDelete = null;
let parsed = emptyParsed();
let bannerTimeout = null;

function emptyParsed() {
    return {
        metadata: {
            className: '',
            chapterNumber: '',
            chapterTitle: ''
        },
        mcq: [],
        blanks: [],
        shorts: [],
        words: []
    };
}

function showBanner(message) {
    const banner = document.getElementById('notificationBanner');
    const bannerText = document.getElementById('bannerText');
    clearTimeout(bannerTimeout);
    bannerText.textContent = message;
    banner.classList.remove('hidden');
    banner.classList.remove('hide');
    banner.classList.add('show');
    bannerTimeout = setTimeout(() => {
        banner.classList.remove('show');
        banner.classList.add('hide');
        setTimeout(() => {
            banner.classList.add('hidden');
            banner.classList.remove('hide');
        }, 300);
    }, 2000);
}

function setLoading(btn, loading, label) {
    if (!btn) return;
    const labelNode = btn.querySelector('.btn-label');
    if (!btn.dataset.originalLabel && labelNode) {
        btn.dataset.originalLabel = labelNode.textContent;
    }
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
    if (labelNode) {
        labelNode.textContent = loading
            ? (label || btn.dataset.originalLabel)
            : btn.dataset.originalLabel;
    }
}

async function runAction(btn, loadingText, action, successMessage) {
    try {
        setLoading(btn, true, loadingText);
        await new Promise(resolve => setTimeout(resolve, 60));
        const result = await action();
        if (successMessage) showBanner(successMessage);
        return result;
    } catch (error) {
        console.error(error);
        showBanner(error.message || 'Something went wrong!');
        return null;
    } finally {
        setLoading(btn, false);
    }
}

function normalizeText(text) {
    return (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
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

function banglaToEnglishNumber(value) {
    return String(value || '').replace(/[০-৯]/g, d => '০১২৩৪৫৬৭৮৯'.indexOf(d));
}

function englishToBanglaNumber(value) {
    return String(value || '').replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[Number(d)]);
}

function extractMetadata(text) {
    const source = normalizeText(text);
    const classMatch = source.match(/শ্রেণি\s*:\s*([^\n]+)/i);
    const encodedClassMatch = source.match(/†kÖwY\s*:\s*([^\n]+)/i);
    const chapterTitleMatch = source.match(/অধ্যায়\s*([০-৯0-9]+)\s*:\s*([^\n]+)/i);
    const chapterInlineMatch = source.match(/অধ্যায়\s*:\s*([০-৯0-9]+)/i);

    const rawClassName = classMatch
        ? classMatch[1].split(/বিষয়|welq|Subject|অধ্যায়/i)[0].trim()
        : encodedClassMatch
            ? encodedClassMatch[1].split(/welq|Subject|অধ্যায়/i)[0].trim()
            : '';

    const encodedClassMap = {
        'Z…Zxq': '3',
        'PZz_©': '4',
        'cÂg': '5',
        'lô': '6',
        'mßg': '7'
    };

    const className = encodedClassMap[rawClassName] || rawClassName;
    const chapterNumberRaw = chapterTitleMatch?.[1] || chapterInlineMatch?.[1] || '';

    return {
        className,
        chapterNumber: chapterNumberRaw ? banglaToEnglishNumber(chapterNumberRaw) : '',
        chapterTitle: chapterTitleMatch?.[2]?.trim() || ''
    };
}

function collectSections(text) {
    const source = normalizeText(text);
    const definitions = [
        { key: 'mcq', pattern: /বহুনির্বাচনী প্রশ্ন\s*:/i },
        { key: 'blanks', pattern: /শূন্যস্থান পূরণ কর\s*:/i },
        { key: 'shorts', pattern: /সংক্ষিপ্ত প্রশ্ন ও উত্তর\s*:/i },
        { key: 'words', pattern: /অনুশীলনীর প্রশ্ন ও সমাধান\s*:/i },
        { key: 'words', pattern: /অতিরিক্ত অনুশীলন\s*:/i }
    ];

    const hits = [];
    definitions.forEach(def => {
        const match = def.pattern.exec(source);
        if (match) {
            hits.push({ key: def.key, start: match.index, end: match.index + match[0].length });
        }
    });

    return hits.sort((a, b) => a.start - b.start).map((hit, index, arr) => ({
        key: hit.key,
        content: source.slice(hit.end, index + 1 < arr.length ? arr[index + 1].start : source.length).trim()
    }));
}

function sliceByNumbers(text) {
    const source = normalizeText(text);
    const matches = [...source.matchAll(/(?:^|\n)\s*([০-৯]+)\.\s*/g)];
    if (!matches.length) return [];

    return matches.map((match, index) => {
        const start = match.index + match[0].length;
        const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
        return {
            num: banglaToEnglishNumber(match[1]),
            body: source.slice(start, end).trim()
        };
    }).filter(Boolean);
}

function sliceInlineNumberedEntries(text) {
    const source = normalizeText(text);
    const matches = [...source.matchAll(/([০-৯]+)\.\s/g)];
    if (!matches.length) return [];

    return matches.map((match, index) => {
        const start = match.index + match[0].length;
        const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
        return {
            num: banglaToEnglishNumber(match[1]),
            body: source.slice(start, end).trim()
        };
    }).filter(item => item.body);
}

function splitQuestionAndAnswer(text) {
    const source = normalizeText(text);
    const answerIndex = source.search(/উত্তরমালা\s*:/i);
    if (answerIndex < 0) {
        return { questions: source.trim(), answers: '' };
    }
    return {
        questions: source.slice(0, answerIndex).trim(),
        answers: source.slice(answerIndex).replace(/^[\s\S]*?উত্তরমালা\s*:/i, '').trim()
    };
}

function autoHardness(questionText) {
    const t = questionText || '';
    if (t.includes('কত') || t.includes('মান')) return 'Medium';
    if (t.length > 100) return 'Hard';
    return 'Easy';
}

function autoTag(questionText) {
    const t = questionText || '';
    if (t.includes('যোগ')) return 'Addition';
    if (t.includes('বিয়োগ') || t.includes('বিয়োগ')) return 'Subtraction';
    if (t.includes('গুণ')) return 'Multiplication';
    if (t.includes('ভাগ')) return 'Division';
    if (t.includes('ভাগফল')) return '4 Operation';
    if (t.includes('গ.ডি.')) return 'LCM-GCD';
    if (t.includes('আয়তন') || t.includes('আয়তন') || t.includes('এলাকা')) return 'Area';
    if (t.includes('কোণ') || t.includes('জ্যামিতি')) return 'Geometry';
    return 'General';
}

function parseMcqSection(text, metadata) {
    const { questions, answers } = splitQuestionAndAnswer(text);
    const answerMap = {};
    [...answers.matchAll(/([০-৯]+)\.\s*([কখগঘ])/g)].forEach(m => {
        answerMap[banglaToEnglishNumber(m[1])] = { 'ক': 'a', 'খ': 'b', 'গ': 'c', 'ঘ': 'd' }[m[2]];
    });

    return sliceByNumbers(questions).map((block, index) => {
        const optionRegex = /ক\)\s*(.*?)\s*খ\)\s*(.*?)\s*গ\)\s*(.*?)\s*ঘ\)\s*(.*)/s;
        const match = block.body.match(optionRegex);
        const questionText = match ? block.body.replace(optionRegex, '').trim() : block.body.trim();
        const options = match ? [
            { id: 'a', key: 'ক', text: match[1].trim(), isCorrect: false },
            { id: 'b', key: 'খ', text: match[2].trim(), isCorrect: false },
            { id: 'c', key: 'গ', text: match[3].trim(), isCorrect: false },
            { id: 'd', key: 'ঘ', text: match[4].trim(), isCorrect: false }
        ] : [];

        const ansId = answerMap[block.num];
        if (ansId) options.forEach(o => o.isCorrect = o.id === ansId);

        return {
            id: `${metadata.chapterNumber.padStart(2, '0')}01${String(index + 1).padStart(3, '0')}`,
            type: 'mcq',
            sectionType: 'mcq',
            question: questionText,
            options,
            chapter: metadata.chapterNumber,
            hardness: autoHardness(questionText),
            tag: autoTag(questionText)
        };
    });
}

function parseBlankSection(text, metadata) {
    const { questions, answers } = splitQuestionAndAnswer(text);
    const answerMap = {};
    sliceInlineNumberedEntries(answers).forEach(block => {
        answerMap[block.num] = block.body;
    });

    return sliceByNumbers(questions).map((block, index) => ({
        id: `${metadata.chapterNumber.padStart(2, '0')}02${String(index + 1).padStart(3, '0')}`,
        type: 'blanks',
        sectionType: 'blanks',
        question: block.body,
        answer: answerMap[block.num] || '',
        chapter: metadata.chapterNumber,
        hardness: autoHardness(block.body),
        tag: autoTag(block.body)
    }));
}

function parseShortSection(text, metadata) {
    return sliceByNumbers(text).map((block, index) => {
        const parts = block.body.split(/\s*উত্তর\s*:\s*/i);
        const question = (parts[0] || '').trim();
        const answer = parts.slice(1).join('উত্তর: ').trim();
        return {
            id: `${metadata.chapterNumber.padStart(2, '0')}03${String(index + 1).padStart(3, '0')}`,
            type: 'short',
            sectionType: 'shorts',
            question,
            answer,
            chapter: metadata.chapterNumber,
            hardness: autoHardness(question),
            tag: autoTag(question)
        };
    }).filter(item => item.question);
}

function extractWordParts(text) {
    const source = normalizeText(text).trim();
    const matches = [...source.matchAll(/\(([কখ])\)\s*/g)];
    const result = { main: source, ko: '', kho: '' };
    if (!matches.length) return result;

    result.main = source.slice(0, matches[0].index).trim();
    matches.forEach((match, index) => {
        const start = match.index + match[0].length;
        const end = index + 1 < matches.length ? matches[index + 1].index : source.length;
        const key = match[1] === 'ক' ? 'ko' : 'kho';
        result[key] = source.slice(start, end).trim();
    });
    return result;
}

function parseWordSection(text, metadata) {
    return sliceByNumbers(text).map((block, index) => {
        const pieces = block.body.split(/\s*সমাধান\s*:\s*/i);
        const q = extractWordParts((pieces[0] || '').trim());
        const s = extractWordParts(pieces.slice(1).join('সমাধান: ').trim());
        const fullText = [q.main, q.ko, q.kho, s.main, s.ko, s.kho].join(' ');
        return {
            id: `${metadata.chapterNumber.padStart(2, '0')}04${String(index + 1).padStart(3, '0')}`,
            type: 'word_problem',
            sectionType: 'words',
            question: q.main,
            questionKo: q.ko,
            questionKho: q.kho,
            solution: s.main,
            solutionKo: s.ko,
            solutionKho: s.kho,
            chapter: metadata.chapterNumber,
            hardness: autoHardness(fullText),
            tag: autoTag(fullText)
        };
    }).filter(item => item.question || item.questionKo || item.questionKho);
}

function parseWholeNote(text) {
    const metadata = extractMetadata(text);
    const result = emptyParsed();
    result.metadata = metadata;

    collectSections(text).forEach(section => {
        if (section.key === 'mcq') result.mcq.push(...parseMcqSection(section.content, metadata));
        if (section.key === 'blanks') result.blanks.push(...parseBlankSection(section.content, metadata));
        if (section.key === 'shorts') result.shorts.push(...parseShortSection(section.content, metadata));
        if (section.key === 'words') result.words.push(...parseWordSection(section.content, metadata));
    });

    return result;
}

function getAllItems() {
    return [...parsed.mcq, ...parsed.blanks, ...parsed.shorts, ...parsed.words];
}

function buildChapterPayload() {
    return {
        class: parsed.metadata.className || '',
        chapterNumber: parsed.metadata.chapterNumber || '',
        chapterTitle: parsed.metadata.chapterTitle || '',
        content: {
            mcq: parsed.mcq,
            blanks: parsed.blanks,
            shorts: parsed.shorts,
            words: parsed.words
        }
    };
}

function reindexCollection(typeKey, sectionCode) {
    const chapter = String(parsed.metadata.chapterNumber || '').padStart(2, '0');
    parsed[typeKey] = (parsed[typeKey] || []).map((item, index) => ({
        ...item,
        id: `${chapter}${sectionCode}${String(index + 1).padStart(3, '0')}`
    }));
}

function reindexAllIds() {
    reindexCollection('mcq', '01');
    reindexCollection('blanks', '02');
    reindexCollection('shorts', '03');
    reindexCollection('words', '04');
}

function showReport() {
    const all = getAllItems();
    const hardnessCount = { Easy: 0, Medium: 0, Hard: 0 };
    const tagCount = {};
    all.forEach(item => {
        hardnessCount[item.hardness]++;
        tagCount[item.tag] = (tagCount[item.tag] || 0) + 1;
    });

    report.innerHTML = `
        <div class="bg-slate-200 p-2 rounded-lg">Class: ${parsed.metadata.className || '-'}</div>
        <div class="bg-slate-200 p-2 rounded-lg">Chapter: ${parsed.metadata.chapterNumber || '-'}${parsed.metadata.chapterTitle ? ` - ${parsed.metadata.chapterTitle}` : ''}</div>
        <div class="bg-slate-200 p-2 rounded-lg">Total Items: ${all.length}</div>
        <div class="bg-slate-200 p-2 rounded-lg">MCQ: ${parsed.mcq.length}, <br> Blanks: ${parsed.blanks.length}, <br> Shorts: ${parsed.shorts.length}, <br> Words: ${parsed.words.length}</div>
        <div class="bg-slate-200 p-2 rounded-lg">Easy: ${hardnessCount.Easy}, <br> Medium: ${hardnessCount.Medium}, <br> Hard: ${hardnessCount.Hard}</div>
        <div class="bg-slate-200 p-2 rounded-lg">Tags: <br> ${Object.entries(tagCount).map(e => `${e[0]}: ${e[1]}`).join(',<br>') || '-'}</div>
    `;
}

function renderSectionHeading(label, count) {
    return `
        <div class="sectionTitle px-4 py-2 rounded-xl shadow text-lg font-bold">
            ${label} (${englishToBanglaNumber(count)})
        </div>
    `;
}

function renderMcqCard(q) {
    return `
        <div class="card bg-white p-4 rounded-xl shadow">
            <div class="mb-2 flex justify-between items-center">
                <div class="text-gray-500 font-mono">ID: ${q.id}</div>
                <button onclick="deleteQuestion('${q.id}','mcq')" class="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-700">Delete</button>
            </div>
            <div class='qtext px-2 py-1 rounded bg-slate-100 flex justify-between items-center w-auto'>
                <span class="bnFont font-semibold text-lg">${formatFractions(q.question)}</span>
                <button onclick="editQuestion('${q.id}','mcq',this)" class="w-20 ml-2 hover:bg-gray-500 hover:text-white px-1 rounded">
                    <i class="fa-regular fa-pen-to-square"></i> Edit
                </button>
            </div>
            <div class="bnFont grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">${q.options.map(o => `<div
                class="opt px-3 py-2 rounded-lg ${o.isCorrect ? 'bg-green-400 text-white border-green-400' : 'bg-slate-100 border-slate-200'} justify-between">
                <span class="w-full font-semibold" onclick="selectCorrect('${q.id}','${o.id}')">${formatFractions(o.text)}</span>
                <button onclick="editOption('${q.id}','${o.id}',this)" class="hover:cursor-pointer px-1 rounded"><i class="fa-regular fa-pen-to-square"></i></button>
            </div>`).join('')}</div>
            ${renderFooter(q, 'mcq')}
        </div>
    `;
}

function renderAnswerCard(q, typeKey, answerFieldLabel = 'Answer') {
    const answerHtml = typeKey === 'words'
        ? `
            ${q.solution ? renderEditableRow('Solution', q.solution, q.id, typeKey, 'solution', true) : ''}
            ${q.solutionKo ? renderEditableRow('Solution (ক)', q.solutionKo, q.id, typeKey, 'solutionKo', true) : ''}
            ${q.solutionKho ? renderEditableRow('Solution (খ)', q.solutionKho, q.id, typeKey, 'solutionKho', true) : ''}
        `
        : renderEditableRow(answerFieldLabel, q.answer, q.id, typeKey, 'answer', false, true);

    const extraQuestions = typeKey === 'words'
        ? `
            ${q.questionKo ? renderEditableRow('Question (ক)', q.questionKo, q.id, typeKey, 'questionKo') : ''}
            ${q.questionKho ? renderEditableRow('Question (খ)', q.questionKho, q.id, typeKey, 'questionKho') : ''}
        `
        : '';

    return `
        <div class="card bg-white p-4 rounded-xl shadow">
            <div class="mb-2 flex justify-between items-center">
                <div class="text-gray-500 font-mono">ID: ${q.id}</div>
                <button onclick="deleteQuestion('${q.id}','${typeKey}')" class="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-700">Delete</button>
            </div>
            ${renderEditableRow(typeKey === 'blanks' ? 'Question' : 'Question', q.question, q.id, typeKey, 'question')}
            ${extraQuestions}
            ${answerHtml}
            ${renderFooter(q, typeKey)}
        </div>
    `;
}

function renderEditableRow(label, value, qid, typeKey, field, preserve = false, amber = false) {
    const cls = amber ? 'bg-amber-50 border border-amber-200' : 'bg-slate-100';
    const preserveClass = preserve ? 'preserveLines' : '';
    return `
        <div class="editableRow ${cls} px-3 py-2 rounded-lg justify-between items-start mt-2">
            <div class="flex-1">
                <div class="text-xs uppercase opacity-70 mb-1">${label}</div>
                <div class="editableValue bnFont font-semibold ${preserveClass}">${formatFractions(value || '')}</div>
            </div>
            <button onclick="editField('${qid}','${typeKey}','${field}',this)" class="w-20 ml-2 hover:bg-gray-500 hover:text-white px-1 rounded">
                <i class="fa-regular fa-pen-to-square"></i> Edit
            </button>
        </div>
    `;
}

function renderFooter(q, typeKey) {
    return `
        <div class="mt-2 h-1 bg-gray-400 opacity-20 rounded-full"></div>
        <div class="mt-3 flex gap-2 flex-wrap">${['Easy', 'Medium', 'Hard'].map(h => `<button
            onclick="setHardness('${q.id}','${typeKey}','${h}')"
            class="px-3 py-1 rounded-lg text-xs ${q.hardness === h ? (h === 'Easy' ? 'bg-green-500 text-white' : h === 'Medium' ? 'bg-yellow-400 text-black' : 'bg-red-500 text-white') : 'bg-slate-200'}">${h}</button>`).join('')}
        </div>
        <div class="mt-2 h-1 bg-gray-400 opacity-20 rounded-full"></div>
        <div class="mt-2 flex gap-2 flex-wrap text-xs">${TAGS.map(t => `<button onclick="setTag('${q.id}','${typeKey}','${t}')"
            class="px-3 py-1 rounded-lg text-xs ${q.tag === t ? 'bg-blue-400 text-white' : 'bg-slate-200'}">${t}</button>`).join('')}
        </div>
    `;
}

function render() {
    const sections = [];
    if (parsed.mcq.length) {
        sections.push(renderSectionHeading(TYPE_LABELS.mcq, parsed.mcq.length));
        sections.push(parsed.mcq.map(renderMcqCard).join(''));
    }
    if (parsed.blanks.length) {
        sections.push(renderSectionHeading(TYPE_LABELS.blanks, parsed.blanks.length));
        sections.push(parsed.blanks.map(item => renderAnswerCard(item, 'blanks')).join(''));
    }
    if (parsed.shorts.length) {
        sections.push(renderSectionHeading(TYPE_LABELS.shorts, parsed.shorts.length));
        sections.push(parsed.shorts.map(item => renderAnswerCard(item, 'shorts')).join(''));
    }
    if (parsed.words.length) {
        sections.push(renderSectionHeading(TYPE_LABELS.words, parsed.words.length));
        sections.push(parsed.words.map(item => renderAnswerCard(item, 'words')).join(''));
    }

    output.innerHTML = sections.join('') || `<div class="card bg-white p-6 rounded-xl shadow text-center">Paste the whole note and click Parse.</div>`;
}

function getCollection(typeKey) {
    return parsed[typeKey];
}

function findItem(typeKey, qid) {
    return getCollection(typeKey).find(item => item.id === qid);
}

function editQuestion(qid, typeKey, btn) {
    const q = findItem(typeKey, qid);
    const span = btn.parentElement.querySelector('span');
    const input = document.createElement('input');
    input.value = q.question;
    input.classList.add('editing');
    input.classList.add('w-full');
    input.classList.add('flex-1');
    span.replaceWith(input);
    input.focus();
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            q.question = input.value;
            q.hardness = autoHardness(JSON.stringify(q));
            q.tag = autoTag(JSON.stringify(q));
            saveProgress();
            render();
            showReport();
            showBanner('Question updated!');
        }
    });
}

function editOption(qid, optId, btn) {
    const q = findItem('mcq', qid);
    const o = q.options.find(o => o.id === optId);
    const span = btn.parentElement.querySelector('span');
    const input = document.createElement('input');
    input.value = o.text;
    input.classList.add('editing');
    input.classList.add('w-full');
    span.replaceWith(input);
    input.focus();
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            o.text = input.value;
            saveProgress();
            render();
            showBanner('Option updated!');
        }
    });
}

function editField(qid, typeKey, field, btn) {
    const q = findItem(typeKey, qid);
    const valueNode = btn.parentElement.querySelector('.editableValue');
    const input = field.startsWith('solution') ? document.createElement('textarea') : document.createElement('input');
    input.value = q[field] || '';
    input.classList.add('editing');
    input.classList.add('w-full');
    if (input.tagName === 'TEXTAREA') {
        input.rows = Math.max(4, input.value.split('\n').length || 4);
    }
    valueNode.replaceWith(input);
    input.focus();
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && (input.tagName !== 'TEXTAREA' || !e.shiftKey)) {
            e.preventDefault();
            q[field] = input.value;
            q.hardness = autoHardness(JSON.stringify(q));
            q.tag = autoTag(JSON.stringify(q));
            saveProgress();
            render();
            showReport();
            showBanner('Updated!');
        }
    });
}

function deleteQuestion(qid, typeKey) {
    questionToDelete = { qid, typeKey };
    document.getElementById('confirmModal').classList.remove('hidden');
}

function selectCorrect(qid, optId) {
    const q = findItem('mcq', qid);
    q.options.forEach(o => o.isCorrect = o.id === optId);
    saveProgress();
    render();
    showBanner('Correct option selected!');
}

function setHardness(qid, typeKey, value) {
    const q = findItem(typeKey, qid);
    q.hardness = value;
    saveProgress();
    render();
    showReport();
    showBanner('Hardness updated!');
}

function setTag(qid, typeKey, value) {
    const q = findItem(typeKey, qid);
    q.tag = value;
    saveProgress();
    render();
    showReport();
    showBanner('Tag updated!');
}

async function parseAll(btn) {
    const total = await runAction(btn, 'Parsing...', () => {
        const text = inputText.value.trim();
        if (!text) throw new Error('Paste the whole note first!');
        parsed = parseWholeNote(text);
        reindexAllIds();
        saveProgress();
        render();
        showReport();
        return getAllItems().length;
    });
    if (typeof total === 'number') {
        showBanner(total ? `Parsed ${total} items!` : 'No supported sections found!');
    }
}

function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        inputText: inputText.value,
        parsed
    }));
}

function loadProgress() {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved) {
        inputText.value = saved.inputText || '';
        parsed = saved.parsed || emptyParsed();
    }
    render();
    showReport();
}

async function clearAll(btn) {
    await runAction(btn, 'Clearing...', () => {
        localStorage.removeItem(STORAGE_KEY);
        inputText.value = '';
        parsed = emptyParsed();
        render();
        report.innerHTML = '';
    }, 'Cleared!');
}

async function copyJSON(btn) {
    await runAction(btn, 'Copying...', async () => {
        await navigator.clipboard.writeText(JSON.stringify(buildChapterPayload(), null, 2));
    }, 'Chapter JSON copied!');
}

async function downloadJSON(btn) {
    await runAction(btn, 'Preparing...', () => {
        const payload = {
            chapters: [buildChapterPayload()]
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const chapterPart = parsed.metadata.chapterNumber || 'chapter';
        a.download = `chapter_${chapterPart}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, 'Chapter JSON downloaded!');
}

document.getElementById('confirmDelete').addEventListener('click', event => {
    runAction(event.currentTarget, 'Deleting...', () => {
        if (questionToDelete) {
            parsed[questionToDelete.typeKey] = parsed[questionToDelete.typeKey].filter(q => q.id !== questionToDelete.qid);
            reindexAllIds();
            saveProgress();
            render();
            showReport();
            questionToDelete = null;
        }
        document.getElementById('confirmModal').classList.add('hidden');
    }, 'Deleted!');
});

document.getElementById('cancelDelete').addEventListener('click', () => {
    questionToDelete = null;
    document.getElementById('confirmModal').classList.add('hidden');
    showBanner('Cancelled!');
});

window.onload = loadProgress;
