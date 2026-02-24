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

    // Build the grid (always 42 cells, starting from Monday of the first week)
    const { cells, selectedWeekIndex, headerMonthName, headerYear } = useMemo(() => {
        const firstOfMonth = new Date(year, month - 1, 1);
        // Find Monday of the week containing the 1st (0=Sun, 1=Mon... 6=Sat)
        // We want (day + 6) % 7 to get 0 for Monday
        const startOffset = (firstOfMonth.getDay() + 6) % 7;

        const startDate = new Date(firstOfMonth);
        startDate.setDate(firstOfMonth.getDate() - startOffset);

        const allCells = [];
        for (let i = 0; i < 42; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const iso = d.toISOString().split('T')[0];
            allCells.push({
                date: iso,
                dayNum: d.getDate(),
                isCurrentMonth: d.getMonth() === month - 1 && d.getFullYear() === year
            });
        }

        let sIndex = 0;
        if (selectedDate) {
            const foundIndex = allCells.findIndex(c => c.date === selectedDate);
            if (foundIndex !== -1) {
                sIndex = Math.floor(foundIndex / 7);
            }
        }

        // Title logic: If collapsed, show the month of the selected date
        let hName = monthName;
        let hYear = year;
        if (!isExpanded && selectedDate) {
            const [sYear, sMonth] = selectedDate.split('-').map(Number);
            const d = new Date(sYear, sMonth - 1, 1);
            hName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(d);
            hYear = sYear;
        }

        return {
            cells: allCells,
            selectedWeekIndex: sIndex,
            headerMonthName: hName,
            headerYear: hYear
        };
    }, [year, month, selectedDate, isExpanded, locale, monthName]);

    function prev() {
        if (isExpanded) {
            const d = new Date(year, month - 2, 1);
            onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        } else {
            const current = new Date(selectedDate);
            current.setDate(current.getDate() - 7);
            const iso = current.toISOString().split('T')[0];
            onDaySelect(iso);
            // If the new date is in a different month, sync currentMonth
            const [ny, nm] = iso.split('-').slice(0, 2);
            if (`${ny}-${nm}` !== currentMonth) {
                onMonthChange(`${ny}-${nm}`);
            }
        }
    }

    function next() {
        if (isExpanded) {
            const d = new Date(year, month, 1);
            onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        } else {
            const current = new Date(selectedDate);
            current.setDate(current.getDate() + 7);
            const iso = current.toISOString().split('T')[0];
            onDaySelect(iso);
            // If the new date is in a different month, sync currentMonth
            const [ny, nm] = iso.split('-').slice(0, 2);
            if (`${ny}-${nm}` !== currentMonth) {
                onMonthChange(`${ny}-${nm}`);
            }
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
                    {headerMonthName} {headerYear}
                    <span className="expand-icon">{isExpanded ? ' ▴' : ' ▾'}</span>
                </span>
                <button className="icon-btn" onClick={next} aria-label="Next">›</button>
            </div>

            <div className="calendar-grid-container">
                <div className="calendar-grid">
                    {dayLabels.map(d => (
                        <div key={d} className="calendar-day-label">{d}</div>
                    ))}

                    {displayedCells.map((cell) => {
                        const { date, dayNum, isCurrentMonth } = cell;
                        const rating = ratingMap[date];
                        const hasEntry = entryDates.has(date);
                        const isToday = date === today;
                        const isSelected = date === selectedDate;

                        return (
                            <div
                                key={date}
                                className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}
                                onClick={() => onDaySelect(date)}
                                role="button"
                                aria-label={`${dayNum} ${headerMonthName}`}
                                aria-pressed={isSelected}
                            >
                                <span>{dayNum}</span>
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
