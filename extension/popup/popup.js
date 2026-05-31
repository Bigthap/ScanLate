// ScanLate v3 Popup Controller

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const statusDot = document.querySelector(".status-dot");
  const statusText = document.getElementById("status-text");
  const offlineOverlay = document.getElementById("offline-overlay");
  const profileSelect = document.getElementById("profile-select");
  const langSelect = document.getElementById("lang-select");
  const btnTranslate = document.getElementById("btn-translate");
  const btnToggleView = document.getElementById("btn-toggle-view");
  const toggleRow = document.getElementById("toggle-row");
  const statusCard = document.getElementById("status-card");
  const progressFill = document.getElementById("progress-bar-fill");
  const progressPercent = document.getElementById("status-progress-percent");
  const progressMsg = document.getElementById("status-progress-msg");
  const progressSub = document.getElementById("status-progress-sub");
  
  const btnRetry = document.getElementById("btn-retry");
  const btnOptions = document.getElementById("btn-options");
  const linkCreateProfile = document.getElementById("link-create-profile");

  // Debug Panel Elements
  const chkDebugMode = document.getElementById("chk-debug-mode");
  const debugLogConsole = document.getElementById("debug-log-console");
  const logEntries = document.getElementById("log-entries");
  const btnClearLogs = document.getElementById("btn-clear-logs");

  let logInterval = null;

  // Get active tab context (allow popup to initialize connection check even if active tab is unavailable)
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = activeTab ? activeTab.id : null;

  // Initialize and check server connection
  async function checkServerAndLoad() {
    statusText.textContent = "กำลังเชื่อมต่อ...";
    statusDot.className = "status-dot offline";
    btnTranslate.disabled = true;
    btnTranslate.classList.add("disabled");

    try {
      // Send query to service worker
      const response = await chrome.runtime.sendMessage({ action: "checkServer" });
      
      if (response && response.status && response.status.status === "online") {
        // Server is Online
        statusDot.className = "status-dot online";
        statusText.textContent = "เชื่อมต่อแล้ว";
        offlineOverlay.classList.add("hidden");
        
        // Populate profile selector
        const profiles = response.profiles || [];
        populateProfiles(profiles);
        
        // Restore tab state
        if (tabId) {
          await restoreTabState();
        }
      } else {
        // Server is Offline
        showOffline();
      }
    } catch (e) {
      console.error("Connection check failed:", e);
      showOffline();
    }
  }

  function showOffline() {
    statusDot.className = "status-dot offline";
    statusText.textContent = "ไม่ได้เชื่อมต่อ";
    offlineOverlay.classList.remove("hidden");
    btnTranslate.disabled = true;
    btnTranslate.classList.add("disabled");
  }

  function populateProfiles(profiles) {
    // Keep placeholder but clear other options
    profileSelect.innerHTML = '<option value="" disabled selected>-- เลือก Profile --</option>';
    
    profiles.forEach(name => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      profileSelect.appendChild(option);
    });
  }

  async function restoreTabState() {
    const res = await chrome.runtime.sendMessage({ action: "getTabState", tabId });
    if (res && res.state) {
      const state = res.state;
      
      // Restore selected profile
      if (state.profileName && profileSelect.querySelector(`option[value="${state.profileName}"]`)) {
        profileSelect.value = state.profileName;
      }
      
      // Restore language
      langSelect.value = state.sourceLang || "auto";
      
      // Restore debug mode
      chkDebugMode.checked = !!state.debugMode;
      if (chkDebugMode.checked) {
        debugLogConsole.classList.remove("hidden");
        startLogPolling();
      } else {
        debugLogConsole.classList.add("hidden");
        stopLogPolling();
      }

      // Adjust UI based on status
      updateUIStatus(state);
    }
  }

  function updateUIStatus(state) {
    const hasProfile = !!profileSelect.value;
    
    if (state.status === "translating") {
      // In progress
      profileSelect.disabled = true;
      langSelect.disabled = true;
      btnTranslate.disabled = true;
      btnTranslate.classList.add("disabled");
      toggleRow.classList.add("hidden");
      statusCard.classList.remove("hidden");
      
      // Calculate progress
      const percent = state.totalCount > 0 ? Math.round((state.translatedCount / state.totalCount) * 100) : 0;
      progressFill.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
      progressMsg.textContent = "กำลังดำเนินการแปล...";
      progressSub.textContent = `กำลังประมวลผลรูปที่ ${state.translatedCount} จากทั้งหมด ${state.totalCount} รูป`;
      
    } else {
      // Idle or completed
      profileSelect.disabled = false;
      langSelect.disabled = false;
      
      btnTranslate.disabled = false;
      btnTranslate.classList.remove("disabled");
      
      statusCard.classList.add("hidden");

      if (state.status === "completed") {
        toggleRow.classList.remove("hidden");
      } else {
        toggleRow.classList.add("hidden");
      }
    }
  }

  // Handle updates to profile/language controls
  async function saveControlsState() {
    if (!tabId) return;
    const profileName = profileSelect.value;
    const sourceLang = langSelect.value;
    const debugMode = chkDebugMode.checked;
    
    const updates = { profileName, sourceLang, debugMode };
    const res = await chrome.runtime.sendMessage({ action: "updateTabState", tabId, updates });
    if (res && res.state) {
      updateUIStatus(res.state);
    }
  }

  profileSelect.addEventListener("change", saveControlsState);
  langSelect.addEventListener("change", saveControlsState);

  // Debug Toggle Event
  chkDebugMode.addEventListener("change", async () => {
    const debugMode = chkDebugMode.checked;
    if (debugMode) {
      debugLogConsole.classList.remove("hidden");
      startLogPolling();
    } else {
      debugLogConsole.classList.add("hidden");
      stopLogPolling();
    }

    if (tabId) {
      await chrome.runtime.sendMessage({
        action: "updateTabState",
        tabId,
        updates: { debugMode }
      });
      // Notify content script of the mode change immediately
      try {
        await chrome.tabs.sendMessage(tabId, { action: "setDebugMode", debugMode });
      } catch (e) {
        // Ignore failure if content script is not injected
      }
    }
  });

  // Clear Logs
  btnClearLogs.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({ action: "clearDebugLogs" });
    logEntries.innerHTML = "";
  });

  // Log Polling Functions
  async function updateLogs() {
    try {
      const response = await chrome.runtime.sendMessage({ action: "getDebugLogs" });
      if (response && response.success && response.logs) {
        logEntries.innerHTML = "";
        response.logs.forEach(log => {
          const div = document.createElement("div");
          div.className = "log-entry";
          
          if (log.includes("[ERROR]")) {
            div.className += " log-entry-error";
          } else if (log.includes("[WARN]")) {
            div.className += " log-entry-warn";
          } else {
            div.className += " log-entry-info";
          }
          
          div.textContent = log;
          logEntries.appendChild(div);
        });
        // Scroll to bottom
        debugLogConsole.scrollTop = debugLogConsole.scrollHeight;
      }
    } catch (e) {
      console.error("Log fetch error:", e);
    }
  }

  function startLogPolling() {
    if (logInterval) clearInterval(logInterval);
    updateLogs();
    logInterval = setInterval(updateLogs, 1000);
  }

  function stopLogPolling() {
    if (logInterval) {
      clearInterval(logInterval);
      logInterval = null;
    }
  }

  // Trigger Translation Command
  btnTranslate.addEventListener("click", async () => {
    if (!tabId) return;
    const profileName = profileSelect.value || "default";
    const sourceLang = langSelect.value;
    const debugMode = chkDebugMode.checked;

    // 1. Update state to translating
    const updates = {
      status: "translating",
      translatedCount: 0,
      totalCount: 0
    };
    await chrome.runtime.sendMessage({ action: "updateTabState", tabId, updates });

    try {
      // 2. Instruct service worker to inject content script (if not already)
      await chrome.runtime.sendMessage({ action: "injectContentScript", tabId });

      // 3. Ping content script to start page scans
      chrome.tabs.sendMessage(tabId, {
        action: "startTranslation",
        profileName,
        sourceLang,
        debugMode
      });
      
    } catch (e) {
      console.error("Translation initiation failed:", e);
      // Reset state on failure
      await chrome.runtime.sendMessage({
        action: "updateTabState",
        tabId,
        updates: { status: "idle" }
      });
    }
  });

  // Toggle translated overlays view
  btnToggleView.addEventListener("click", async () => {
    if (!tabId) return;
    try {
      chrome.tabs.sendMessage(tabId, { action: "toggleView" });
    } catch (e) {
      console.error("Failed to toggle view in tab:", e);
    }
  });

  // Listen for background state broadcasts (e.g. from page translation completion)
  chrome.runtime.onMessage.addListener((message) => {
    if (tabId && message.action === "tabStateChanged" && message.tabId === tabId) {
      updateUIStatus(message.state);
    }
  });

  // Page Redirection buttons
  btnRetry.addEventListener("click", checkServerAndLoad);
  
  btnOptions.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  linkCreateProfile.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // Run initial server check
  checkServerAndLoad();
});
