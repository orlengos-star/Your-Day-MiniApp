import { useState, useMemo, useEffect } from 'react';

const RATING_COLORS = {
    1: '#E57373', 2: '#FFB74D', 3: '#FFF176', 4: '#AED581', 5: '#66BB6A'
};

export default function Calendar({
    currentMonth,
    onMonthChange,
    onDaySelect,
    selectedDate,
    ratings = [],
    entries = [],
    forceCollapse = false,
    lang = 'en'
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [year, month] = currentMonth.split('-').map(Number);

    const locale = lang === 'ru' ? 'ru' : 'en-GB';

    // Build localized month names and days
    const monthName = useMemo(() => {
        const d = new Date(year, month - 1, 1);
        return new Intl.DateTimeFormat(locale, { month: 'long' }).format(d);
    }, [year, month, locale]);

    const dayLabels = useMemo(() => {
        const labels = [];
        const baseDate = new Date(2021, 0, 4); // Monday
        for (let i = 0; i < 7; i++) {
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() + i);
            let label = new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(d);
            // Capitalize first letter (especially for RU)
            label = label.charAt(0).toUpperCase() + label.slice(1);
            labels.push(label);
        }
        return labels;
    }, [locale]);

    // Auto-collapse when requested
    useEffect(() => {
        if (forceCollapse) setIsExpanded(false);
    }, [forceCollapse]);

    const today = new Date().toISOString().split('T')[0];

    // Build lookup maps
    const ratingMap = useMemo(() => {
        const map = {};
        for (const r of ratings) map[r.date] = r.clientRating;
        return map;
    }, [ratings]);

    const entryDates = useMemo(() => new Set(entries.map(e => e.entryDate)), [entries]);

    const { cells, selectedWeekIndex } = useMemo(() => {
        const firstDay = new Date(year, month - 1, 1);
        const startOffset = (firstDay.getDay() + 6) % 7;
        const daysInMonth = new Date(year, month, 0).getDate();

        const allCells = [];
        for (let i = 0; i < startOffset; i++) allCells.push(null);
        for (let d = 1; d <= daysInMonth; d++) allCells.push(d);

        // Pad to full weeks
        while (allCells.length % 7 !== 0) allCells.push(null);

        let sIndex = 0;
        if (selectedDate) {
            const [sYear, sMonth, sDay] = selectedDate.split('-').map(Number);
            if (sYear === year && sMonth === month) {
                const dayIndexInGrid = startOffset + sDay - 1;
                sIndex = Math.floor(dayIndexInGrid / 7);
            }
        }

        return { cells: allCells, selectedWeekIndex: sIndex };
    }, [year, month, selectedDate]);

    function prev() {
        if (isExpanded) {
            const d = new Date(year, month - 2, 1);
            onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        } else {
            // In week mode, move 7 days back
            const current = new Date(selectedDate);
            current.setDate(current.getDate() - 7);
            onDaySelect(current.toISOString().split('T')[0]);
        }
    }

    function next() {
        if (isExpanded) {
            const d = new Date(year, month, 1);
            onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        } else {
            // In week mode, move 7 days forward
            const current = new Date(selectedDate);
            current.setDate(current.getDate() + 7);
            onDaySelect(current.toISOString().split('T')[0]);
        }
    }

    const displayedCells = isExpanded
        ? cells
        : cells.slice(selectedWeekIndex * 7, (selectedWeekIndex * 7) + 7);

    return (
        <div className={`calendar ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
            <div className="calendar-header">
                <button className="icon-btn" onClick={prev} aria-label="Previous">‹</button>
                <span className="calendar-month" onClick={() => setIsExpanded(!isExpanded)}>
                    {monthName} {year}
                    <span className="expand-icon">{isExpanded ? ' ▴' : ' ▾'}</span>
                </span>
                <button className="icon-btn" onClick={next} aria-label="Next">›</button>
            </div>

            <div className="calendar-grid-container">
                <div className="calendar-grid">
                    {dayLabels.map(d => (
                        <div key={d} className="calendar-day-label">{d}</div>
                    ))}

                    {displayedCells.map((day, i) => {
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
                                aria-label={`${day} ${monthName}`}
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

            <div className="calendar-drag-handle" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="drag-line" />
            </div>
        </div>
    );
}
