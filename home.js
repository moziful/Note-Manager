const HOME_NOTE_KEY = 'noteHubQuickNote';
let homeBannerTimer = null;

function showHomeBanner(message) {
    const banner = document.getElementById('homeBanner');
    const text = document.getElementById('homeBannerText');
    clearTimeout(homeBannerTimer);
    text.textContent = message;
    banner.classList.remove('hidden');
    banner.classList.add('show');
    homeBannerTimer = setTimeout(() => {
        banner.classList.remove('show');
        banner.classList.add('hidden');
    }, 1800);
}

function updateClock() {
    const now = new Date();
    document.getElementById('liveClock').textContent = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    document.getElementById('liveDate').textContent = now.toLocaleDateString([], {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const label = document.getElementById('calendarLabel');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    label.textContent = now.toLocaleDateString([], {
        month: 'long',
        year: 'numeric'
    });

    const cells = [];
    for (let i = 0; i < firstDay; i += 1) {
        cells.push('<div class="calendarCell calendarMuted"></div>');
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const activeClass = day === today ? 'calendarToday' : '';
        cells.push(`<div class="calendarCell ${activeClass}">${day}</div>`);
    }
    grid.innerHTML = cells.join('');
}

function loadQuickNote() {
    const input = document.getElementById('quickNoteInput');
    input.value = localStorage.getItem(HOME_NOTE_KEY) || '';
}

function saveQuickNote() {
    const input = document.getElementById('quickNoteInput');
    localStorage.setItem(HOME_NOTE_KEY, input.value);
    showHomeBanner('Quick note saved!');
}

function clearQuickNote() {
    const input = document.getElementById('quickNoteInput');
    input.value = '';
    localStorage.removeItem(HOME_NOTE_KEY);
    showHomeBanner('Quick note cleared!');
}

document.getElementById('saveQuickNoteBtn').addEventListener('click', saveQuickNote);
document.getElementById('clearQuickNoteBtn').addEventListener('click', clearQuickNote);
window.onload = () => {
    updateClock();
    renderCalendar();
    loadQuickNote();
    setInterval(updateClock, 1000);
};
