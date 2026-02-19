import { useState } from 'react';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const RATING_COLORS = {
    1: '#E57373', 2: '#FFB74D', 3: '#FFF176', 4: '#AED581', 5: '#66BB6A'
};

export default function Calendar({ currentMonth, onMonthChange, onDaySelect, selectedDate, ratings = [], entries = [] }) {
    const [year, month] = currentMonth.split('-').map(Number);

    const firstDay = new Date(year, month - 1, 1);
    // Monday-first: 0=Mon, 6=Sun
    const startOffset = (firstDay.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month, 0).getDate();

    const today = new Date().toISOString().split('T')[0];

    // Build lookup maps
    const ratingMap = {};
    for (const r of ratings) ratingMap[r.date] = r.clientRating;

    const entryDates = new Set(entries.map(e => e.entryDate));

    function prevMonth() {
        const d = new Date(year, month - 2, 1);
        onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    function nextMonth() {
        const d = new Date(year, month, 1);
        onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }

    const cells = [];
    // Empty cells before first day
    for (let i = 0; i < startOffset; i++) cells.push(null);
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div className="calendar">
            <div className="calendar-header">
                <button className="icon-btn" onClick={prevMonth} aria-label="Previous month">‹</button>
                <span className="calendar-month">{MONTHS[month - 1]} {year}</span>
                <button className="icon-btn" onClick={nextMonth} aria-label="Next month">›</button>
            </div>

            <div className="calendar-grid">
                {DAYS.map(d => (
                    <div key={d} className="calendar-day-label">{d}</div>
                ))}

                {cells.map((day, i) => {
                    if (!day) return <div key={`empty-${i}`} className="calendar-day empty" />;

                    const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                    const rating = ratingMap[dateStr];
                    const hasEntry = entryDates.has(dateStr);
                    const isToday = dateStr === today;
                    const isSelected = dateStr === selectedDate;

                    return (
                        <div
                            key={dateStr}
                            className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                            onClick={() => onDaySelect(dateStr)}
                            role="button"
                            aria-label={`${day} ${MONTHS[month - 1]}`}
                            aria-pressed={isSelected}
                        >
                            <span>{day}</span>
                            {hasEntry && (
                                <div
                                    className="day-dot"
                                    style={{ background: rating ? RATING_COLORS[rating] : 'var(--accent)' }}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
