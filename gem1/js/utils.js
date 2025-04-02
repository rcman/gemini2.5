// js/utils.js

const Utils = {
    /**
     * Generates a random integer between min (inclusive) and max (inclusive).
     */
    getRandomInt(min, max) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
    * Adds a message to the on-screen log.
    */
    logMessage(message) {
        const log = document.getElementById('message-log');
        if (!log) return;

        const p = document.createElement('p');
        p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        log.appendChild(p);

        // Auto-scroll to bottom
        log.scrollTop = log.scrollHeight;

        // Optional: Limit log length
        const maxMessages = 20;
        while (log.children.length > maxMessages) {
            log.removeChild(log.firstChild);
        }
    }
};

// Make it globally accessible (or use module pattern if preferred)
window.Utils = Utils;