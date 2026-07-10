(() => {
  "use strict";

  const STORAGE_KEY = "front-facing-square-wheel-v1";
  const DB_NAME = "front-facing-square-wheel-db";
  const DB_STORE = "settings";
  const MAX_HISTORY = 10;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const normalizeDeg = (value) => ((value % 360) + 360) % 360;

  const svgData = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const iconSvg = (symbol, background) => svgData(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <defs>
        <radialGradient id="g" cx="34%" cy="23%">
          <stop offset="0" stop-color="#fff" stop-opacity=".45"/>
          <stop offset=".36" stop-color="${background}" stop-opacity=".96"/>
          <stop offset="1" stop-color="${background}"/>
        </radialGradient>
      </defs>
      <rect x="12" y="12" width="176" height="176" rx="18" fill="url(#g)" stroke="#fff" stroke-opacity=".75" stroke-width="8"/>
      <text x="100" y="124" text-anchor="middle" font-size="92" font-family="Arial, sans-serif" font-weight="900" fill="#fff">${symbol}</text>
    </svg>
  `);

  function makeId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `choice-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  const DEFAULT_STATE = {
    version: 1,
    rotationDeg: 0,
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
      backgroundColor: "#100d18",
      backgroundImage: "",
      backgroundOverlay: 0.22,
      backgroundFit: "cover",
      frameColor: "#df641f",
      trimColor: "#e9e8ef",
      windowColor: "#08080d",
      pointerColor: "#ef4f58",
      buttonColor: "#e75a36",
      lightColor: "#fff2a8",
      panelColor: "#191525",
      accentColor: "#f4a621",
      textColor: "#f7f4fb"
    },
    behavior: {
      spinDuration: 6,
      minRotations: 5,
      showResult: true,
      showResultLabel: false,
      keepHistory: true,
      showPercentages: true,
      confettiEnabled: true,
      soundEnabled: true
    }
  };

  const elements = {
    reelWindow: $("#reelWindow"),
    reelCylinder: $("#reelCylinder"),
    spinButton: $("#spinButton"),
    status: $("#statusMessage"),
    choiceList: $("#choiceList"),
    choiceTemplate: $("#choiceTemplate"),
    totalWeight: $("#totalWeight"),
    editor: $("#editorPanel"),
    settingsBtn: $("#settingsBtn"),
    closeSettingsBtn: $("#closeSettingsBtn"),
    presentBtn: $("#presentBtn"),
    fullscreenBtn: $("#fullscreenBtn"),
    historyPanel: $("#historyPanel"),
    historyList: $("#historyList"),
    clearHistoryBtn: $("#clearHistoryBtn"),
    resultModal: $("#resultModal"),
    resultImage: $("#resultImage"),
    resultTitle: $("#resultTitle"),
    resultProbability: $("#resultProbability"),
    resultTile: $("#resultTile"),
    spinAgainBtn: $("#spinAgainBtn"),
    confettiCanvas: $("#confettiCanvas"),
    backgroundLayer: $("#backgroundLayer")
  };

  const controls = {
    addChoiceBtn: $("#addChoiceBtn"),
    backgroundColor: $("#backgroundColor"),
    backgroundOverlay: $("#backgroundOverlay"),
    backgroundFit: $("#backgroundFit"),
    backgroundUpload: $("#backgroundUpload"),
    removeBackgroundBtn: $("#removeBackgroundBtn"),
    frameColor: $("#frameColor"),
    trimColor: $("#trimColor"),
    windowColor: $("#windowColor"),
    pointerColor: $("#pointerColor"),
    buttonColor: $("#buttonColor"),
    lightColor: $("#lightColor"),
    panelColor: $("#panelColor"),
    accentColor: $("#accentColor"),
    textColor: $("#textColor"),
    spinDuration: $("#spinDuration"),
    spinDurationOutput: $("#spinDurationOutput"),
    minRotations: $("#minRotations"),
    rotationsOutput: $("#rotationsOutput"),
    showResult: $("#showResult"),
    showResultLabel: $("#showResultLabel"),
    keepHistory: $("#keepHistory"),
    showPercentages: $("#showPercentages"),
    confettiEnabled: $("#confettiEnabled"),
    soundEnabled: $("#soundEnabled"),
    exportBtn: $("#exportBtn"),
    importInput: $("#importInput"),
    resetBtn: $("#resetBtn")
  };

  let state = deepClone(DEFAULT_STATE);
  let spinning = false;
  let saveTimer = null;
  let statusTimer = null;
  let audioContext = null;
  let stepDeg = 360 / state.choices.length;
  let radius = 220;
  let tileSize = 240;
  let lastTickIndex = -1;
  let resizeObserver;

  init();

  async function init() {
    state = await loadState();
    sanitizeState();
    bindEvents();
    syncControls();
    applyAppearance();
    renderChoiceEditor();
    renderReel();
    renderHistory();

    resizeObserver = new ResizeObserver(layoutReel);
    resizeObserver.observe(elements.reelWindow);
    requestAnimationFrame(layoutReel);
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

    state.rotationDeg = Number.isFinite(Number(state.rotationDeg)) ? Number(state.rotationDeg) : 0;
    state.history = state.history.slice(0, MAX_HISTORY);
  }

  async function loadState() {
    try {
      const saved = await idbGet(STORAGE_KEY);
      if (saved) return mergeState(saved);
    } catch (error) {
      console.warn("IndexedDB load failed.", error);
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return mergeState(JSON.parse(raw));
    } catch (error) {
      console.warn("localStorage load failed.", error);
    }

    try {
      const response = await fetch("./wheel-config.json", { cache: "no-store" });
      if (response.ok) {
        const parsed = await response.json();
        return mergeState(parsed.state || parsed);
      }
    } catch {
      // wheel-config.json is optional.
    }

    return deepClone(DEFAULT_STATE);
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB unavailable."));
      const request = indexedDB.open(DB_NAME, 1);
      request.onerror = () => reject(request.error || new Error("Could not open IndexedDB."));
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
    });
  }

  async function idbGet(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const request = tx.objectStore(DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.oncomplete = () => db.close();
    });
  }

  async function idbSet(key, value) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error); };
    });
  }

  async function idbDelete(key) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
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
          setStatus("Browser storage is full. Export the wheel file to protect your setup.");
        }
      }
    }, 150);
  }

  function bindEvents() {
    elements.spinButton.addEventListener("click", spin);
    elements.spinAgainBtn.addEventListener("click", () => {
      closeResult();
      setTimeout(spin, 120);
    });

    document.addEventListener("keydown", (event) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
      if (event.code === "Space" && !typing && !spinning && elements.resultModal.hidden) {
        event.preventDefault();
        spin();
      }
      if (event.key === "Escape") {
        closeResult();
        elements.editor.classList.remove("open");
        if (document.body.classList.contains("presenting")) togglePresentation(false);
      }
    });

    $$("[data-close-modal]").forEach(node => node.addEventListener("click", closeResult));

    $$(".tab").forEach(tab => tab.addEventListener("click", () => {
      $$(".tab").forEach(item => {
        const active = item === tab;
        item.classList.toggle("active", active);
        item.setAttribute("aria-selected", String(active));
      });
      $$(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.dataset.panel === tab.dataset.tab));
    }));

    elements.settingsBtn.addEventListener("click", () => elements.editor.classList.add("open"));
    elements.closeSettingsBtn.addEventListener("click", () => elements.editor.classList.remove("open"));
    elements.presentBtn.addEventListener("click", () => togglePresentation());
    elements.fullscreenBtn.addEventListener("click", toggleFullscreen);
    controls.addChoiceBtn.addEventListener("click", addChoice);

    elements.clearHistoryBtn.addEventListener("click", () => {
      state.history = [];
      renderHistory();
      saveState();
    });

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

    controls.removeBackgroundBtn.addEventListener("click", () => {
      state.appearance.backgroundImage = "";
      applyAppearance();
      saveState();
    });

    controls.exportBtn.addEventListener("click", exportWheel);
    controls.importInput.addEventListener("change", importWheel);
    controls.resetBtn.addEventListener("click", resetLocalChanges);
  }

  function bindAppearanceControls() {
    const mappings = [
      ["backgroundColor", "backgroundColor"],
      ["backgroundOverlay", "backgroundOverlay"],
      ["backgroundFit", "backgroundFit"],
      ["frameColor", "frameColor"],
      ["trimColor", "trimColor"],
      ["windowColor", "windowColor"],
      ["pointerColor", "pointerColor"],
      ["buttonColor", "buttonColor"],
      ["lightColor", "lightColor"],
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
      ["minRotations", "minRotations", "number"],
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
        if (stateName === "keepHistory") renderHistory();
        if (stateName === "showPercentages") renderChoiceEditor();
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
    controls.rotationsOutput.value = String(state.behavior.minRotations);
  }

  function applyAppearance() {
    const a = state.appearance;
    const root = document.documentElement.style;
    root.setProperty("--bg", a.backgroundColor);
    root.setProperty("--panel", a.panelColor);
    root.setProperty("--panel-rgb", hexToRgb(a.panelColor));
    root.setProperty("--accent", a.accentColor);
    root.setProperty("--accent-rgb", hexToRgb(a.accentColor));
    root.setProperty("--text", a.textColor);
    root.setProperty("--frame", a.frameColor);
    root.setProperty("--trim", a.trimColor);
    root.setProperty("--window", a.windowColor);
    root.setProperty("--pointer", a.pointerColor);
    root.setProperty("--button", a.buttonColor);
    root.setProperty("--light", a.lightColor);

    elements.backgroundLayer.style.setProperty("--overlay", a.backgroundOverlay);
    elements.backgroundLayer.style.backgroundColor = a.backgroundColor;
    elements.backgroundLayer.style.backgroundImage = a.backgroundImage ? `url("${a.backgroundImage}")` : "none";
    if (a.backgroundFit === "repeat") {
      elements.backgroundLayer.style.backgroundRepeat = "repeat";
      elements.backgroundLayer.style.backgroundSize = "auto";
    } else {
      elements.backgroundLayer.style.backgroundRepeat = "no-repeat";
      elements.backgroundLayer.style.backgroundSize = a.backgroundFit;
    }
  }

  function renderReel() {
    elements.reelCylinder.replaceChildren();
    stepDeg = 360 / state.choices.length;

    state.choices.forEach((choice, index) => {
      const tile = document.createElement("div");
      tile.className = "reel-tile";
      tile.style.setProperty("--tile-angle", `${index * stepDeg}deg`);
      tile.style.setProperty("--tile-color", choice.color);
      tile.dataset.choiceId = choice.id;
      tile.setAttribute("aria-label", choice.label || `Choice ${index + 1}`);

      const image = document.createElement("img");
      image.src = choice.image || fallbackImage(index);
      image.alt = "";
      image.draggable = false;
      tile.append(image);
      elements.reelCylinder.append(tile);
    });

    requestAnimationFrame(layoutReel);
  }

  function layoutReel() {
    const height = elements.reelWindow.clientHeight || 500;
    const width = elements.reelWindow.clientWidth || 500;
    const responsive = Math.min(height * .47, width * .56);
    tileSize = Math.round(clamp(responsive, 145, 270));

    const rawRadius = (tileSize / 2) / Math.tan(Math.PI / state.choices.length);
    radius = Math.round(Math.max(tileSize * .62, rawRadius));

    elements.reelWindow.style.setProperty("--tile-size", `${tileSize}px`);
    elements.reelCylinder.style.setProperty("--radius", `${radius}px`);
    setReelTransform(state.rotationDeg);
  }

  function setReelTransform(rotationDeg) {
    elements.reelCylinder.style.transform = `translateZ(${-radius}px) rotateX(${rotationDeg}deg)`;
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
        elements.reelCylinder.querySelector(`[data-choice-id="${cssEscape(choice.id)}"]`)?.style.setProperty("--tile-color", choice.color);
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
          const reelImage = elements.reelCylinder.querySelector(`[data-choice-id="${cssEscape(choice.id)}"] img`);
          if (reelImage) reelImage.src = choice.image;
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
    normalizeCurrentRotation();
    renderChoiceEditor();
    renderReel();
    saveState();
  }

  function moveChoice(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= state.choices.length) return;
    [state.choices[index], state.choices[target]] = [state.choices[target], state.choices[index]];
    normalizeCurrentRotation();
    renderChoiceEditor();
    renderReel();
    saveState();
  }

  function duplicateChoice(index) {
    const source = state.choices[index];
    state.choices.splice(index + 1, 0, { ...source, id: makeId(), label: `${source.label || "Choice"} copy` });
    normalizeCurrentRotation();
    renderChoiceEditor();
    renderReel();
    saveState();
  }

  function removeChoice(index) {
    if (state.choices.length <= 3) {
      setStatus("Keep at least three choices on the reel.");
      return;
    }
    state.choices.splice(index, 1);
    normalizeCurrentRotation();
    renderChoiceEditor();
    renderReel();
    saveState();
  }

  function normalizeCurrentRotation() {
    state.rotationDeg = 0;
    stepDeg = 360 / state.choices.length;
  }

  async function spin() {
    if (spinning || state.choices.length < 3) return;

    spinning = true;
    elements.spinButton.disabled = true;
    closeResult();
    elements.status.textContent = "";
    if (state.behavior.soundEnabled) getAudioContext();

    const winnerIndex = chooseWeightedIndex();
    const desired = normalizeDeg(-winnerIndex * stepDeg);
    const current = state.rotationDeg;
    const currentNorm = normalizeDeg(current);
    const downwardDelta = normalizeDeg(currentNorm - desired);
    const fullRotations = Math.floor(Number(state.behavior.minRotations)) + Math.floor(Math.random() * 3);
    const target = current - fullRotations * 360 - downwardDelta;

    const start = performance.now();
    const duration = Number(state.behavior.spinDuration) * 1000;
    const startRotation = current;
    lastTickIndex = frontIndexForRotation(current);

    const animate = now => {
      const progress = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 5);
      state.rotationDeg = startRotation + (target - startRotation) * eased;
      setReelTransform(state.rotationDeg);
      tickIfNeeded();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        state.rotationDeg = target;
        setReelTransform(state.rotationDeg);
        spinning = false;
        elements.spinButton.disabled = false;
        saveState();
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

  function frontIndexForRotation(rotation) {
    const index = Math.round(normalizeDeg(-rotation) / stepDeg) % state.choices.length;
    return index;
  }

  function tickIfNeeded() {
    const index = frontIndexForRotation(state.rotationDeg);
    if (index !== lastTickIndex) {
      lastTickIndex = index;
      playTick();
    }
  }

  function finishSpin(winnerIndex) {
    const winner = state.choices[winnerIndex];
    const chance = winner.weight / totalWeight();
    const label = winner.label?.trim() || `Choice ${winnerIndex + 1}`;

    setStatus(state.behavior.showResultLabel ? `Selected: ${label}` : "A choice was selected.");

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

    playWin();

    if (state.behavior.showResult) {
      elements.resultImage.src = winner.image || fallbackImage(winnerIndex);
      elements.resultTitle.textContent = state.behavior.showResultLabel ? label : "Selected choice";
      elements.resultProbability.textContent = state.behavior.showPercentages ? `${formatPercent(chance)} probability` : "";
      elements.resultTile.style.setProperty("--result-color", winner.color);
      elements.resultModal.hidden = false;
    }

    if (state.behavior.confettiEnabled) launchConfetti();
  }

  function renderHistory() {
    elements.historyPanel.hidden = !state.behavior.keepHistory;
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

  function closeResult() {
    elements.resultModal.hidden = true;
  }

  function togglePresentation(force) {
    const next = typeof force === "boolean" ? force : !document.body.classList.contains("presenting");
    document.body.classList.toggle("presenting", next);
    elements.presentBtn.textContent = next ? "Exit presentation" : "Present";
    elements.editor.classList.remove("open");
    setTimeout(layoutReel, 40);
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
      app: "front-facing-square-wheel",
      exportedAt: new Date().toISOString(),
      state: { ...state, rotationDeg: 0, history: [] }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `front-facing-wheel-${new Date().toISOString().slice(0,10)}.json`;
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
      renderReel();
      renderHistory();
      saveState();
      setStatus("Wheel file imported.");
    } catch {
      setStatus("That file is not a valid wheel export.");
    }
    event.target.value = "";
  }

  async function resetLocalChanges() {
    if (!window.confirm("Clear this browser's changes and reload the published wheel configuration?")) return;
    try { await idbDelete(STORAGE_KEY); } catch {}
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    location.reload();
  }

  function compressImage(file, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) return reject(new Error("Not an image."));
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
    oscillator.frequency.value = 720;
    gain.gain.setValueAtTime(.025, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .035);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + .04);
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
    return state.choices.reduce((sum, choice) => sum + clamp(Number(choice.weight) || .01, .01, 100000), 0);
  }

  function fallbackImage(index) {
    return iconSvg(String(index + 1), "#7651d8");
  }

  function setStatus(message) {
    elements.status.textContent = message;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      if (!spinning) elements.status.textContent = "";
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

  function cssEscape(value) {
    return window.CSS?.escape ? CSS.escape(value) : value.replace(/["\\]/g, "\\$&");
  }
})();
