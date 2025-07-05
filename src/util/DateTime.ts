export const sleep = (milliseconds: number): Promise<void> => {
    return new Promise(resolve => {
        setTimeout(resolve, milliseconds);
    })
};

export const humanizeTimeAmount = (time: number): string => {
    let humanizedTime = time;
    let humanizedUnit = 'millisecond';
    const timeUnits: Record<string, number> = {
        second: SECOND,
        minute: MINUTE,
        hour: HOUR,
        day: DAY,
        week: WEEK,
        year: YEAR,
    };

    for (const unit in timeUnits) {
        const nextUnitFactor = timeUnits[unit];
        const nextUnitAmount = humanizedTime / nextUnitFactor;

        if (humanizedTime > nextUnitFactor && Number.isInteger(nextUnitAmount)) {
            humanizedTime /= nextUnitFactor
            humanizedUnit = unit;
        } else {
            break;
        }
    }

    return `${humanizedTime} ${humanizedUnit}${humanizedTime > 1 ? 's' : ''}`;
};

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;
export const YEAR = 365 * DAY;
