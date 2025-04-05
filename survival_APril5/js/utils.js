// js/utils.js

// Example utility functions if needed

// Generate a random number in a range
export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Clamp a number between min and max
export function clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
}

// Lerp (linear interpolation)
export function lerp(start, end, amount) {
    return (1 - amount) * start + amount * end;
}
