(() => {
  "use strict";

  const STORAGE_KEY = "simple-box-prize-wheel-v1";
  const DB_NAME = "simple-box-prize-wheel-db";
  const DB_STORE = "settings";
  const MAX_HISTORY = 10;
  const COLUMN_COUNT = 3;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const svgData = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const iconSvg = (symbol, background) => svgData(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160">
      <defs>
        <radialGradient id="g" cx="34%" cy="23%">
          <stop offset="0" stop-color="#fff" stop-opacity=".48"/>
          <stop offset=".38" stop-color="${background}" stop-opacity=".96"/>
          <stop offset="1" stop-color="${background}"/>
        </radialGradient>
      </defs>
      <rect x="10" y="10" width="180" height="140" rx="15" fill="url(#g)" stroke="#fff" stroke-opacity=".72" stroke-width="7"/>
      <text x="100" y="109" text-anchor="middle" font-size="84" font-family="Arial, sans-serif" font-weight="900" fill="#fff">${symbol}</text>
    </svg>
  `);

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `choice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  const DEFAULT_STATE = {
    version: 1,
    history: [],
    choices: [
      { id: makeId(), label: "Star", image: iconSvg("★", "#7651d8"), color: "#7651d8", weight: 12 },
      { id: makeId(), label: "Coins", image: iconSvg("●", "#d89e20"), color: "#d89e20", weight: 45 },
      { id: makeId(), label: "Mystery", image: iconSvg("?", "#3287d1"), color: "#3287d1", weight: 8 },
      { id: makeId(), label: "Power", image: iconSvg("⚡", "#c94772"), color: "#c94772", weight: 12 },
      { id: makeId(), label: "Shop", image: iconSvg("◆", "#2f9d6c"), color: "#2f9d6c", weight: 8 },
      { id: makeId(), label: "Danger", image: iconSvg("!", "#a63a3f"), color: "#a63a3f", weight: 15 }
    ],
    appearance: {
      backgroundColor: "#111018",
      backgroundImage: "",
      backgroundOverlay: 0.18,
      backgroundFit: "cover",
      boxColor: "#e8e0ce",
      boxBorderColor: "#18b8a6",
      tileBorderColor: "#2f2b31",
      selectionColor: "#18b8a6",
      arrowColor: "#18b8a6",
      buttonColor: "#f4e5bf",
      panelColor: "#181521",
      accentColor: "#f6a623",
      textColor: "#f8f6fb"
    },
    behavior: {
      spinDuration: 5,
      visibleRows: 5,
      showResult: true,
      showResultLabel: false,
      keepHistory: true,
      showPercentages: true,
      confettiEnabled: true,
      soundEnabled: true
    }
  };

  const elements = {
    settingsToggle: $("#settingsToggle"),
    resultsToggle: $("#resultsToggle"),
    fullscreenButton: $("#fullscreenButton"),
    editorPanel: $("#editorPanel"),
    closeEditor: $("#closeEditor"),
    resultsPanel: $("#resultsPanel"),
    closeResults: $("#closeResults"),
    clearHistoryButton: $("#clearHistoryButton"),
    historyList: $("#historyList"),
    reelBoard: $("#reelBoard"),
    wheelBox: $("#wheelBox"),
    spinButton: $("#spinButton"),
    statusMessage: $("#statusMessage"),
    choiceList: $("#choiceList"),
    choiceTemplate: $("#choiceTemplate"),
    totalWeight: $("#totalWeight"),
    resultModal: $("#resultModal"),
    resultTitle: $("#resultTitle"),
    resultTile: $("#resultTile"),
    resultImage: $("#resultImage"),
    resultProbability: $("#resultProbability"),
    spinAgainButton: $("#spinAgainButton"),
    confettiCanvas: $("#confettiCanvas"),
    backgroundLayer: $("#backgroundLayer")
  };

  const controls = {
    addChoiceButton: $("#addChoiceButton"),
    backgroundColor: $("#backgroundColor"),
    backgroundOverlay: $("#backgroundOverlay"),
    backgroundFit: $("#backgroundFit"),
    backgroundUpload: $("#backgroundUpload"),
    removeBackgroundButton: $("#removeBackgroundButton"),
    boxColor: $("#boxColor"),
    boxBorderColor: $("#boxBorderColor"),
    tileBorderColor: $("#tileBorderColor"),
    selectionColor: $("#selectionColor"),
    arrowColor: $("#arrowColor"),
    buttonColor: $("#buttonColor"),
    panelColor: $("#panelColor"),
    accentColor: $("#accentColor"),
    textColor: $("#textColor"),
    spinDuration: $("#spinDuration"),
    spinDurationOutput: $("#spinDurationOutput"),
    visibleRows: $("#visibleRows"),
    visibleRowsOutput: $("#visibleRowsOutput"),
    showResult: $("#showResult"),
    showResultLabel: $("#showResultLabel"),
    keepHistory: $("#keepHistory"),
    showPercentages: $("#showPercentages"),
    confettiEnabled: $("#confettiEnabled"),
    soundEnabled: $("#soundEnabled"),
    exportButton: $("#exportButton"),
    importInput: $("#importInput"),
    clearLocalButton: $("#clearLocalButton")
  };

  let state = deepClone(DEFAULT_STATE);
  let spinning = false;
  let saveTimer = null;
  let statusTimer = null;
  let audioContext = null;
  let currentBoardChoices = [];

  init();

  async function init() {
    state = await loadState();
    sanitizeState();
    bindEvents();
    syncControls();
    applyAppearance();
    renderChoiceEditor();
    renderBoard();
    renderHistory();
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function mergeState(saved) {
    const base = deepClone(DEFAULT_STATE);
    return {
      ...base,
      ...saved,
      appearance: { ...base.appearance, ...(saved?.appearance || {}) },
      behavior: { ...base.behavior, ...(saved?.behavior || {}) },
      choices: Array.isArray(saved?.choices) && saved.choices.length ? saved.choices : base.choices,
      history: Array.isArray(saved?.history) ? saved.history : []
    };
  }

  function sanitizeState() {
    state.choices = state.choices.filter(Boolean).map((choice, index) => ({
      id: choice.id || makeId(),
      label: String(choice.label || `Choice ${index + 1}`).slice(0, 50),
      image: typeof choice.image === "string" ? choice.image : "",
      color: /^#[0-9a-f]{6}$/i.test(choice.color || "") ? choice.color : "#7651d8",
      weight: clamp(Number(choice.weight) || 1, 0.01, 100000)
    }));

    const defaults = deepClone(DEFAULT_STATE.choices);
    while (state.choices.length < 3) {
      state.choices.push({ ...defaults[state.choices.length % defaults.length], id: makeId() });
    }

    state.behavior.visibleRows = [3, 5, 7].includes(Number(state.behavior.visibleRows))
      ? Number(state.behavior.visibleRows)
      : 5;

    state.history = state.history.slice(0, MAX_HISTORY);
  }

  async function loadState() {
    try {
      const saved = await idbGet(STORAGE_KEY);
      if (saved) return mergeState(saved);
    } catch {}

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return mergeState(JSON.parse(raw));
    } catch {}

    try {
      const response = await fetch("./wheel-config.json", { cache: "no-store" });
      if (response.ok) {
        const parsed = await response.json();
        return mergeState(parsed.state || parsed);
      }
    } catch {}

    return deepClone(DEFAULT_STATE);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable"));
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error || new Error("Could not open database"));
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DB_STORE)) database.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  async function idbGet(key) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, "readonly");
      const request = transaction.objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  }

  async function idbSet(key, value) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, "readwrite");
      transaction.objectStore(DB_STORE).put(value, key);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
      transaction.onabort = () => { database.close(); reject(transaction.error); };
    });
  }

  async function idbDelete(key) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DB_STORE, "readwrite");
      transaction.objectStore(DB_STORE).delete(key);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    });
  }

  function saveState() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await idbSet(STORAGE_KEY, state);
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
      } catch {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
          setStatus("Browser storage is full. Export your wheel file to protect the setup.");
        }
      }
    }, 150);
  }

  function bindEvents() {
    elements.settingsToggle.addEventListener("click", openEditor);
    elements.closeEditor.addEventListener("click", closeEditor);
    elements.resultsToggle.addEventListener("click", openResults);
    elements.closeResults.addEventListener("click", closeResults);
    elements.fullscreenButton.addEventListener("click", toggleFullscreen);
    elements.spinButton.addEventListener("click", spin);
    elements.spinAgainButton.addEventListener("click", () => {
      closeResultModal();
      setTimeout(spin, 100);
    });

    elements.clearHistoryButton.addEventListener("click", () => {
      state.history = [];
      renderHistory();
      saveState();
    });

    document.addEventListener("keydown", event => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
      if (event.code === "Space" && !typing && !spinning && elements.resultModal.hidden) {
        event.preventDefault();
        spin();
      }
      if (event.key === "Escape") {
        closeEditor();
        closeResults();
        closeResultModal();
      }
    });

    $$("[data-close-modal]").forEach(node => node.addEventListener("click", closeResultModal));

    $$(".tab").forEach(tab => tab.addEventListener("click", () => {
      $$(".tab").forEach(item => {
        const active = item === tab;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      $$(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab));
    }));

    controls.addChoiceButton.addEventListener("click", addChoice);
    bindAppearanceControls();
    bindBehaviorControls();

    controls.backgroundUpload.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        state.appearance.backgroundImage = await compressImage(file, 1920, .86);
        applyAppearance();
        saveState();
      } catch {
        setStatus("That background image could not be loaded.");
      }
      event.target.value = "";
    });

    controls.removeBackgroundButton.addEventListener("click", () => {
      state.appearance.backgroundImage = "";
      applyAppearance();
      saveState();
    });

    controls.exportButton.addEventListener("click", exportWheel);
    controls.importInput.addEventListener("change", importWheel);
    controls.clearLocalButton.addEventListener("click", clearLocalChanges);
  }

  function openEditor() {
    elements.editorPanel.classList.add("open");
    elements.editorPanel.setAttribute("aria-hidden", "false");
  }

  function closeEditor() {
    elements.editorPanel.classList.remove("open");
    elements.editorPanel.setAttribute("aria-hidden", "true");
  }

  function openResults() {
    if (!state.behavior.keepHistory) {
      setStatus("Result history is turned off in Customize → Behavior.");
      return;
    }
    elements.resultsPanel.classList.add("open");
    elements.resultsPanel.setAttribute("aria-hidden", "false");
  }

  function closeResults() {
    elements.resultsPanel.classList.remove("open");
    elements.resultsPanel.setAttribute("aria-hidden", "true");
  }

  function bindAppearanceControls() {
    const mappings = [
      ["backgroundColor", "backgroundColor"],
      ["backgroundOverlay", "backgroundOverlay"],
      ["backgroundFit", "backgroundFit"],
      ["boxColor", "boxColor"],
      ["boxBorderColor", "boxBorderColor"],
      ["tileBorderColor", "tileBorderColor"],
      ["selectionColor", "selectionColor"],
      ["arrowColor", "arrowColor"],
      ["buttonColor", "buttonColor"],
      ["panelColor", "panelColor"],
      ["accentColor", "accentColor"],
      ["textColor", "textColor"]
    ];

    mappings.forEach(([controlName, stateName]) => {
      controls[controlName].addEventListener("input", () => {
        const node = controls[controlName];
        state.appearance[stateName] = node.type === "range" ? Number(node.value) : node.value;
        applyAppearance();
        saveState();
      });
    });
  }

  function bindBehaviorControls() {
    const mappings = [
      ["spinDuration", "spinDuration", "number"],
      ["visibleRows", "visibleRows", "number"],
      ["showResult", "showResult", "boolean"],
      ["showResultLabel", "showResultLabel", "boolean"],
      ["keepHistory", "keepHistory", "boolean"],
      ["showPercentages", "showPercentages", "boolean"],
      ["confettiEnabled", "confettiEnabled", "boolean"],
      ["soundEnabled", "soundEnabled", "boolean"]
    ];

    mappings.forEach(([controlName, stateName, type]) => {
      controls[controlName].addEventListener("input", () => {
        const node = controls[controlName];
        state.behavior[stateName] = type === "boolean" ? node.checked : Number(node.value);
        syncBehaviorOutputs();

        if (stateName === "visibleRows") renderBoard();
        if (stateName === "showPercentages") renderChoiceEditor();
        if (stateName === "keepHistory") {
          renderHistory();
          if (!state.behavior.keepHistory) closeResults();
        }

        saveState();
      });
    });
  }

  function syncControls() {
    Object.entries(state.appearance).forEach(([key, value]) => {
      if (controls[key] && controls[key].type !== "file") controls[key].value = value;
    });

    Object.entries(state.behavior).forEach(([key, value]) => {
      const node = controls[key];
      if (!node) return;
      if (node.type === "checkbox") node.checked = Boolean(value);
      else node.value = value;
    });

    syncBehaviorOutputs();
  }

  function syncBehaviorOutputs() {
    controls.spinDurationOutput.value = `${Number(state.behavior.spinDuration).toFixed(1)}s`;
    controls.visibleRowsOutput.value = String(state.behavior.visibleRows);
  }

  function applyAppearance() {
    const appearance = state.appearance;
    const style = document.documentElement.style;

    style.setProperty("--background", appearance.backgroundColor);
    style.setProperty("--panel", appearance.panelColor);
    style.setProperty("--panel-rgb", hexToRgb(appearance.panelColor));
    style.setProperty("--accent", appearance.accentColor);
    style.setProperty("--accent-rgb", hexToRgb(appearance.accentColor));
    style.setProperty("--text", appearance.textColor);
    style.setProperty("--box", appearance.boxColor);
    style.setProperty("--box-border", appearance.boxBorderColor);
    style.setProperty("--tile-border", appearance.tileBorderColor);
    style.setProperty("--selection", appearance.selectionColor);
    style.setProperty("--arrow", appearance.arrowColor);
    style.setProperty("--button", appearance.buttonColor);

    elements.backgroundLayer.style.setProperty("--overlay", appearance.backgroundOverlay);
    elements.backgroundLayer.style.backgroundColor = appearance.backgroundColor;
    elements.backgroundLayer.style.backgroundImage = appearance.backgroundImage ? `url("${appearance.backgroundImage}")` : "none";

    if (appearance.backgroundFit === "repeat") {
      elements.backgroundLayer.style.backgroundRepeat = "repeat";
      elements.backgroundLayer.style.backgroundSize = "auto";
    } else {
      elements.backgroundLayer.style.backgroundRepeat = "no-repeat";
      elements.backgroundLayer.style.backgroundSize = appearance.backgroundFit;
    }
  }

  function renderBoard(finalWinnerIndex = null) {
    const rows = Number(state.behavior.visibleRows);
    const totalCells = rows * COLUMN_COUNT;
    const centerRow = Math.floor(rows / 2);
    const targetCell = centerRow * COLUMN_COUNT + 1;

    elements.reelBoard.style.setProperty("--rows", rows);
    elements.wheelBox.style.setProperty("--rows", rows);

    if (finalWinnerIndex === null) {
      currentBoardChoices = Array.from({ length: totalCells }, (_, index) => index % state.choices.length);
    } else {
      currentBoardChoices = Array.from({ length: totalCells }, () => randomChoiceIndex());
      currentBoardChoices[targetCell] = finalWinnerIndex;
    }

    elements.reelBoard.replaceChildren();

    currentBoardChoices.forEach((choiceIndex, cellIndex) => {
      const choice = state.choices[choiceIndex];
      const tile = document.createElement("div");
      tile.className = "reel-tile";
      if (cellIndex === targetCell) tile.classList.add("target-tile");
      tile.style.setProperty("--tile-color", choice.color);

      const image = document.createElement("img");
      image.src = choice.image || fallbackImage(choiceIndex);
      image.alt = "";
      image.draggable = false;

      tile.append(image);
      elements.reelBoard.append(tile);
    });
  }

  function shuffleBoard() {
    const rows = Number(state.behavior.visibleRows);
    const totalCells = rows * COLUMN_COUNT;
    const centerCell = Math.floor(rows / 2) * COLUMN_COUNT + 1;

    currentBoardChoices = Array.from({ length: totalCells }, () => randomChoiceIndex());

    [...elements.reelBoard.children].forEach((tile, index) => {
      const choice = state.choices[currentBoardChoices[index]];
      tile.style.setProperty("--tile-color", choice.color);
      const image = $("img", tile);
      image.src = choice.image || fallbackImage(currentBoardChoices[index]);
      tile.classList.toggle("target-tile", index === centerCell);
    });

    playTick();
  }

  function renderChoiceEditor() {
    elements.choiceList.replaceChildren();
    const total = totalWeight();

    state.choices.forEach((choice, index) => {
      const fragment = elements.choiceTemplate.content.cloneNode(true);
      const card = $(".choice-card", fragment);
      const previewWrap = $(".choice-preview", fragment);
      const preview = $(".choice-preview img", fragment);
      const number = $(".choice-number", fragment);
      const label = $(".choice-label", fragment);
      const upload = $(".choice-upload", fragment);
      const color = $(".choice-color", fragment);
      const weight = $(".choice-weight", fragment);
      const probability = $(".choice-probability", fragment);

      previewWrap.style.background = choice.color;
      preview.src = choice.image || fallbackImage(index);
      preview.alt = `${choice.label || `Choice ${index + 1}`} preview`;
      number.textContent = index + 1;
      label.value = choice.label;
      color.value = choice.color;
      weight.value = choice.weight;
      probability.textContent = state.behavior.showPercentages ? formatPercent(choice.weight / total) : "—";

      label.addEventListener("input", () => {
        choice.label = label.value;
        saveState();
      });

      color.addEventListener("input", () => {
        choice.color = color.value;
        previewWrap.style.background = choice.color;
        renderBoard();
        saveState();
      });

      weight.addEventListener("input", () => {
        choice.weight = clamp(Number(weight.value) || .01, .01, 100000);
        updateProbabilityLabels();
        saveState();
      });

      upload.addEventListener("change", async event => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
          choice.image = await compressImage(file, 1024, .92);
          preview.src = choice.image;
          renderBoard();
          saveState();
        } catch {
          setStatus("That choice image could not be loaded.");
        }

        event.target.value = "";
      });

      $(".move-up", fragment).addEventListener("click", () => moveChoice(index, -1));
      $(".move-down", fragment).addEventListener("click", () => moveChoice(index, 1));
      $(".duplicate-choice", fragment).addEventListener("click", () => duplicateChoice(index));
      $(".remove-choice", fragment).addEventListener("click", () => removeChoice(index));

      $(".move-up", fragment).disabled = index === 0;
      $(".move-down", fragment).disabled = index === state.choices.length - 1;
      $(".remove-choice", fragment).disabled = state.choices.length <= 3;
      card.dataset.choiceId = choice.id;

      elements.choiceList.append(fragment);
    });

    elements.totalWeight.textContent = trimNumber(total);
  }

  function updateProbabilityLabels() {
    const total = totalWeight();

    $$(".choice-card", elements.choiceList).forEach((card, index) => {
      $(".choice-probability", card).textContent = state.behavior.showPercentages
        ? formatPercent(state.choices[index].weight / total)
        : "—";
    });

    elements.totalWeight.textContent = trimNumber(total);
  }

  function addChoice() {
    const palette = ["#7651d8", "#d89e20", "#3287d1", "#c94772", "#2f9d6c", "#a63a3f", "#568f45"];
    const color = palette[state.choices.length % palette.length];

    state.choices.push({
      id: makeId(),
      label: `Choice ${state.choices.length + 1}`,
      image: iconSvg("?", color),
      color,
      weight: 1
    });

    renderChoiceEditor();
    renderBoard();
    saveState();
  }

  function moveChoice(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= state.choices.length) return;

    [state.choices[index], state.choices[target]] = [state.choices[target], state.choices[index]];
    renderChoiceEditor();
    renderBoard();
    saveState();
  }

  function duplicateChoice(index) {
    const source = state.choices[index];
    state.choices.splice(index + 1, 0, {
      ...source,
      id: makeId(),
      label: `${source.label || "Choice"} copy`
    });

    renderChoiceEditor();
    renderBoard();
    saveState();
  }

  function removeChoice(index) {
    if (state.choices.length <= 3) {
      setStatus("Keep at least three choices on the wheel.");
      return;
    }

    state.choices.splice(index, 1);
    renderChoiceEditor();
    renderBoard();
    saveState();
  }

  function spin() {
    if (spinning) return;

    spinning = true;
    elements.spinButton.disabled = true;
    elements.statusMessage.textContent = "";
    closeResultModal();

    if (state.behavior.soundEnabled) getAudioContext();

    const winnerIndex = chooseWeightedIndex();
    const duration = Number(state.behavior.spinDuration) * 1000;
    const started = performance.now();
    let nextShuffle = started;
    elements.reelBoard.classList.add("spinning");

    const animate = now => {
      const progress = clamp((now - started) / duration, 0, 1);

      if (now >= nextShuffle && progress < 1) {
        shuffleBoard();
        const delay = 45 + Math.pow(progress, 3.2) * 430;
        nextShuffle = now + delay;
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        elements.reelBoard.classList.remove("spinning");
        renderBoard(winnerIndex);
        spinning = false;
        elements.spinButton.disabled = false;
        finishSpin(winnerIndex);
      }
    };

    requestAnimationFrame(animate);
  }

  function chooseWeightedIndex() {
    let roll = Math.random() * totalWeight();

    for (let index = 0; index < state.choices.length; index += 1) {
      roll -= state.choices[index].weight;
      if (roll < 0) return index;
    }

    return state.choices.length - 1;
  }

  function randomChoiceIndex() {
    return Math.floor(Math.random() * state.choices.length);
  }

  function finishSpin(winnerIndex) {
    const winner = state.choices[winnerIndex];
    const chance = winner.weight / totalWeight();
    const label = winner.label?.trim() || `Choice ${winnerIndex + 1}`;

    setStatus(state.behavior.showResultLabel ? `Selected: ${label}` : "A choice was selected.");
    playWin();

    if (state.behavior.keepHistory) {
      state.history.unshift({
        id: makeId(),
        choiceId: winner.id,
        label,
        image: winner.image,
        color: winner.color,
        probability: chance,
        timestamp: Date.now()
      });

      state.history = state.history.slice(0, MAX_HISTORY);
      renderHistory();
      saveState();
    }

    if (state.behavior.showResult) {
      elements.resultImage.src = winner.image || fallbackImage(winnerIndex);
      elements.resultTitle.textContent = state.behavior.showResultLabel ? label : "Selected choice";
      elements.resultProbability.textContent = state.behavior.showPercentages
        ? `${formatPercent(chance)} probability`
        : "";
      elements.resultTile.style.setProperty("--result-color", winner.color);
      elements.resultModal.hidden = false;
    }

    if (state.behavior.confettiEnabled) launchConfetti();
  }

  function renderHistory() {
    elements.resultsToggle.hidden = !state.behavior.keepHistory;
    elements.historyList.replaceChildren();

    if (!state.history.length) {
      const empty = document.createElement("span");
      empty.className = "history-empty";
      empty.textContent = "Results will appear here after you spin.";
      elements.historyList.append(empty);
      return;
    }

    state.history.forEach(result => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.style.setProperty("--history-color", result.color || "rgba(255,255,255,.06)");
      item.title = state.behavior.showPercentages
        ? `${result.label} — ${formatPercent(result.probability || 0)}`
        : result.label;

      const image = document.createElement("img");
      image.src = result.image || fallbackImage(0);
      image.alt = result.label;

      item.append(image);
      elements.historyList.append(item);
    });
  }

  function closeResultModal() {
    elements.resultModal.hidden = true;
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      setStatus("Full screen was blocked by the browser.");
    }
  }

  function exportWheel() {
    const payload = {
      app: "simple-box-prize-wheel",
      exportedAt: new Date().toISOString(),
      state: { ...state, history: [] }
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `simple-box-wheel-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Wheel file exported.");
  }

  async function importWheel(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      state = mergeState(parsed.state || parsed);
      sanitizeState();
      syncControls();
      applyAppearance();
      renderChoiceEditor();
      renderBoard();
      renderHistory();
      saveState();
      setStatus("Wheel file imported.");
    } catch {
      setStatus("That file is not a valid wheel export.");
    }

    event.target.value = "";
  }

  async function clearLocalChanges() {
    if (!window.confirm("Clear this browser's changes and reload the published wheel configuration?")) return;

    try { await idbDelete(STORAGE_KEY); } catch {}
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    location.reload();
  }

  function compressImage(file, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) return reject(new Error("Not an image"));

      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
          const width = Math.max(1, Math.round(image.naturalWidth * scale));
          const height = Math.max(1, Math.round(image.naturalHeight * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext("2d");
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(image, 0, 0, width, height);

          let result = canvas.toDataURL("image/webp", quality);
          if (!result.startsWith("data:image/webp")) result = canvas.toDataURL("image/png");
          resolve(result);
        };

        image.src = String(reader.result);
      };

      reader.readAsDataURL(file);
    });
  }

  function launchConfetti() {
    const canvas = elements.confettiCanvas;
    const context = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    const colors = state.choices.map(choice => choice.color);
    const particles = Array.from({ length: 120 }, () => ({
      x: window.innerWidth * (.25 + Math.random() * .5),
      y: window.innerHeight * .32,
      vx: (Math.random() - .5) * 13,
      vy: -5 - Math.random() * 10,
      gravity: .22 + Math.random() * .12,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - .5) * .3,
      width: 5 + Math.random() * 8,
      height: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)] || state.appearance.accentColor
    }));

    const started = performance.now();

    const animate = now => {
      const elapsed = now - started;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);

      particles.forEach(particle => {
        particle.vy += particle.gravity;
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.rotation += particle.rotationSpeed;

        context.save();
        context.globalAlpha = Math.max(0, 1 - elapsed / 2200);
        context.translate(particle.x, particle.y);
        context.rotate(particle.rotation);
        context.fillStyle = particle.color;
        context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
        context.restore();
      });

      if (elapsed < 2200) requestAnimationFrame(animate);
      else context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };

    requestAnimationFrame(animate);
  }

  function getAudioContext() {
    if (!state.behavior.soundEnabled) return null;
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  }

  function playTick() {
    const audio = getAudioContext();
    if (!audio) return;

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = 690;
    gain.gain.setValueAtTime(.02, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .03);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + .035);
  }

  function playWin() {
    const audio = getAudioContext();
    if (!audio) return;

    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + index * .085;

      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.11, start + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .34);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + .36);
    });
  }

  function totalWeight() {
    return state.choices.reduce(
      (sum, choice) => sum + clamp(Number(choice.weight) || .01, .01, 100000),
      0
    );
  }

  function fallbackImage(index) {
    return iconSvg(String(index + 1), "#7651d8");
  }

  function setStatus(message) {
    elements.statusMessage.textContent = message;
    clearTimeout(statusTimer);

    statusTimer = setTimeout(() => {
      if (!spinning) elements.statusMessage.textContent = "";
    }, 4000);
  }

  function formatPercent(value) {
    const percent = value * 100;
    if (percent >= 10) return `${percent.toFixed(1).replace(/\.0$/, "")}%`;
    if (percent >= 1) return `${percent.toFixed(2).replace(/0$/, "").replace(/\.$/, "")}%`;
    return `${percent.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}%`;
  }

  function trimNumber(value) {
    return Number(value.toFixed(4)).toString();
  }

  function hexToRgb(hex) {
    const value = parseInt(hex.replace("#", ""), 16);
    return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
  }
})();
