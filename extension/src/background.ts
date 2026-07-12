// EnZIME Extension — background service worker stub.
//
// Real implementation: capture queue management, Creator-handoff
// dispatch, message routing between popup and content script.
// See ../ARCHITECTURE.md and ../CHECKLIST.md Phase Extension-1+.

chrome.runtime.onInstalled.addListener(() => {
    console.log("EnZIME Extension installed (bootstrap stub)");
});

// Real message handling pending the architect session's decision on
// the popup ↔ background ↔ content-script protocol.
