export const formattedDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses van de 0 a 11
    const year = date.getFullYear();

    const formattedDate = `${day}/${month}/${year}`;

    return formattedDate;
}

// ---- Lima time (America/Lima, UTC-5 all year, no DST), independent of the server's timezone.
export const LIMA_TIME_ZONE = 'America/Lima';
const LIMA_OFFSET = '-05:00';

const limaFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

function limaParts(date: Date) {
    const parts = Object.fromEntries(limaFormat.formatToParts(date).map((p) => [p.type, p.value]));
    return { yyyy: parts.year!, mm: parts.month!, dd: parts.day!, hh: parts.hour!, min: parts.minute! };
}

// dd/mm/yyyy in Lima.
export const limaDate = (date: Date) => {
    const { yyyy, mm, dd } = limaParts(date);
    return `${dd}/${mm}/${yyyy}`;
};

// HH:mm (24 h) in Lima.
export const limaTime = (date: Date) => {
    const { hh, min } = limaParts(date);
    return `${hh}:${min}`;
};

// yyyymmdd in Lima, e.g. 20261119.
export const limaCompactDate = (date: Date) => {
    const { yyyy, mm, dd } = limaParts(date);
    return `${yyyy}${mm}${dd}`;
};

// yyyy-mm-dd in Lima (the format of DATE columns), e.g. 2026-11-19.
export const limaIsoDate = (date: Date) => {
    const { yyyy, mm, dd } = limaParts(date);
    return `${yyyy}-${mm}-${dd}`;
};

// A Lima day ("yyyy-mm-dd") + a time ("HH:mm") -> that instant.
export const limaInstant = (day: string, time: string) => new Date(`${day}T${time}:00${LIMA_OFFSET}`);

// "yyyy-mm-dd" (a day in Lima) -> the instant that day starts. null when the text isn't a real date.
export function limaDayStart(text: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const date = new Date(`${text}T00:00:00${LIMA_OFFSET}`);
    return Number.isNaN(date.getTime()) || limaCompactDate(date) !== text.replaceAll('-', '') ? null : date;
}
