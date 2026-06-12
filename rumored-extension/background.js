const CONTEXT_MENU_ID = "verify-rumo-red";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "Verify with RumoRED",
    contexts: ["selection"],
  });

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

// ⚠️ NOT async — keeps the user gesture token alive for sidePanel.open()
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID) return;

  const selectedText = info.selectionText?.trim();
  if (!selectedText || !tab?.id) return;

  // 1. Open panel FIRST — synchronously, gesture token still alive
  chrome.sidePanel.open({ tabId: tab.id });

  // 2. Store text AFTER — no await needed, plain callback style
  chrome.storage.session.set({
    pendingVerification: {
      text: selectedText,
      timestamp: Date.now(),
    },
  });
});