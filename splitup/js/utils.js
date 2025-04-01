// js/utils.js
// General utility functions

let feedbackTimeout = null;

// --- UI Feedback ---
export function showActionFeedback(text) {
    const feedback = document.getElementById("action-feedback");
    if (!feedback) return; // Guard against missing element
    feedback.textContent = text;
    feedback.style.display = "block";
    clearTimeout(feedbackTimeout);
    feedbackTimeout = setTimeout(() => { feedback.style.display = "none"; }, 1500);
}

// You could add other general helper functions here if needed