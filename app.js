/**
 * Rosins Bingo Application Logic - Plain & Strict Ownership Edition
 * Real-Time Multiplayer Sync via PeerJS WebRTC (v1.0.6)
 * New in v1.0.6: Confetti on Bingo, Live Scoreboard, Dark Mode, Download Board as Image
 */

const APP_VERSION = "1.0.6";

const ROSIN_PRESETS = [
  "Frank meckert über Hygiene",
  "Testessen ist ein Desaster",
  "Frittierfett ist uralt / schwarz",
  "Frank kocht Gericht vor",
  "Silberbänke / Uralte Deko",
  "Gastronom weint vor Frank",
  "Frank sagt: 'Lecker ist anders'",
  "Speisekarte hat 60+ Gerichte",
  "Fertigsoße / Dosenpilze entdeckt",
  "Frank wirft Essen in Müll",
  "Köche streiten in Küche",
  "Frank verdreht die Augen",
  "Frank spuckt Essen aus",
  "Kühlraum ist unordentlich",
  "Frank macht Ansage im Gastraum",
  "Neues Konzept & neue Karte",
  "Finales Testessen 5/5 Sterne",
  "Geräte in der Küche kaputt",
  "Service weiß nix über Gerichte",
  "Frank seufzt tief",
  "Familienbetrieb zerstritten",
  "Preise sind viel zu günstig",
  "Frank fasst sich an den Kopf",
  "Gäste beschweren sich"
];

const FRANKY_IMAGES = [
  { name: "Frank bond", file: "assets/franky/Frank bond.webp" },
  { name: "Frank entsetzt", file: "assets/franky/Frank entsetzt.jpg" },
  { name: "Frank glücklich", file: "assets/franky/Frank glücklich.webp" },
  { name: "Frank goldig", file: "assets/franky/Frank goldig.jpg" },
  { name: "Frank hat hunger", file: "assets/franky/Frank hat hunger.jpg" },
  { name: "Frank hip und modern", file: "assets/franky/Frank hip und modern.jpg" },
  { name: "Frank klartext", file: "assets/franky/Frank klartext.jpg" },
  { name: "Frank leckermäulchen", file: "assets/franky/Frank leckermäulchen.webp" },
  { name: "Frank mega sexy", file: "assets/franky/Frank mega sexy.jpg" },
  { name: "Frank mitgefühlsvoll", file: "assets/franky/Frank mitgefühlsvoll.jpg" },
  { name: "Frank multitalent", file: "assets/franky/Frank multitalent.jpg" },
  { name: "Frank mysteriös", file: "assets/franky/Frank mysteriös.jpg" },
  { name: "Frank nachdenklich", file: "assets/franky/Frank nachdenklich.jpg" },
  { name: "Frank sagt das N wort", file: "assets/franky/Frank sagt das N wort.avif" },
  { name: "Frank schlau", file: "assets/franky/Frank schlau.jpg" },
  { name: "Frank sexy", file: "assets/franky/Frank sexy.jpg" },
  { name: "Frank sinatra", file: "assets/franky/Frank sinatra.jpg" },
  { name: "Frank sportlich", file: "assets/franky/Frank sportlich.jpg" },
  { name: "Frank sprachlos", file: "assets/franky/Frank sprachlos.webp" },
  { name: "Frank sympathisch", file: "assets/franky/Frank sympathisch.webp" },
  { name: "Frank todesanzeige", file: "assets/franky/Frank todesanzeige.webp" },
  { name: "Frank verführerisch", file: "assets/franky/Frank verführerisch.jpg" }
];

// Shared network state
let state = { gridSize: 4, boards: [] };

// Local-only device state
let localActiveUser = "";
let previousBingoBoards = new Set(); // Track which boards already had bingo to avoid repeat confetti

const LOCAL_USER_KEY = "rosins_bingo_local_user_v5";
const DARK_MODE_KEY = "rosins_bingo_dark_mode";

// Multiplayer PeerJS state
let currentRoomId = "";
let peer = null;
let isHost = false;
let hostConnection = null;
let clientConnections = [];
let isApplyingNetworkUpdate = false;
let pendingMutationState = null;

// Modal state
let activeBoardId = null;
let activeTileIndex = null;
let claimingBoardId = null;
let designBoardId = null;
let selectedBgImage = "";

document.addEventListener("DOMContentLoaded", () => {
  initRoomId();
  loadLocalUser();
  loadDarkMode();
  loadState();
  renderApp();
  setupEventListeners();
  initMultiplayerNetwork();
});

// ── Dark Mode ────────────────────────────────────────────────────────────────

function loadDarkMode() {
  const saved = localStorage.getItem(DARK_MODE_KEY);
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    document.getElementById("btn-dark-mode").textContent = "Hell";
  }
}

function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(DARK_MODE_KEY, next);
  document.getElementById("btn-dark-mode").textContent = next === "dark" ? "Hell" : "Dunkel";
}

// ── Scoreboard ───────────────────────────────────────────────────────────────

function renderScoreboard() {
  const container = document.getElementById("scoreboard-content");
  container.innerHTML = "";

  const claimed = state.boards.filter(b => b.playerName);

  if (claimed.length === 0) {
    container.innerHTML = `<p class="scoreboard-empty">Noch keine Spieler aktiv.</p>`;
    return;
  }

  // Sort: most bingos first, then most marked
  const rows = claimed.map(board => {
    const result = checkBingo(board);
    const marked = board.tiles.filter(t => t.marked).length;
    const total = board.tiles.length;
    return { board, hasBingo: result.hasBingo, marked, total };
  }).sort((a, b) => {
    if (b.hasBingo !== a.hasBingo) return b.hasBingo ? 1 : -1;
    return b.marked - a.marked;
  });

  rows.forEach(({ board, hasBingo, marked, total }) => {
    const isMe = board.playerName === localActiveUser;
    const row = document.createElement("div");
    row.className = "scoreboard-row";
    row.innerHTML = `
      <span class="scoreboard-name ${isMe ? "is-me" : ""}">${escapeHtml(board.playerName)}</span>
      <div class="scoreboard-stats">
        <div class="scoreboard-stat">
          <strong>${hasBingo ? "JA" : "–"}</strong>
          <span>Bingo</span>
        </div>
        <div class="scoreboard-stat">
          <strong>${marked}</strong>
          <span>Markiert</span>
        </div>
        <div class="scoreboard-stat">
          <strong>${total - marked}</strong>
          <span>Offen</span>
        </div>
      </div>
    `;
    container.appendChild(row);
  });
}

// ── Confetti on Bingo ────────────────────────────────────────────────────────

function checkAndFireConfetti() {
  state.boards.forEach(board => {
    if (!board.playerName) return;
    const result = checkBingo(board);
    if (result.hasBingo && !previousBingoBoards.has(board.id)) {
      previousBingoBoards.add(board.id);
      if (typeof confetti !== "undefined") {
        confetti({
          particleCount: 200,
          spread: 80,
          origin: { y: 0.6 },
          colors: ["#dc2626", "#ffffff", "#0f172a", "#fbbf24"]
        });
        // Second burst for extra fun
        setTimeout(() => {
          confetti({ particleCount: 120, spread: 100, origin: { x: 0.2, y: 0.5 } });
          confetti({ particleCount: 120, spread: 100, origin: { x: 0.8, y: 0.5 } });
        }, 400);
      }
    }
    // Reset confetti tracking if bingo is cleared (new round)
    if (!result.hasBingo && previousBingoBoards.has(board.id)) {
      previousBingoBoards.delete(board.id);
    }
  });
}

// ── Download Board as Image ──────────────────────────────────────────────────

function downloadBoardAsImage(boardId) {
  const cards = document.querySelectorAll(".bingo-board-card");
  let targetCard = null;
  cards.forEach(card => {
    if (card.dataset.boardId === boardId) targetCard = card;
  });

  if (!targetCard || typeof html2canvas === "undefined") {
    alert("Download nicht verfügbar.");
    return;
  }

  const board = state.boards.find(b => b.id === boardId);
  const playerName = board ? board.playerName || "Bingo" : "Bingo";

  html2canvas(targetCard, {
    scale: 2,
    useCORS: true,
    backgroundColor: document.documentElement.getAttribute("data-theme") === "dark" ? "#1e293b" : "#ffffff"
  }).then(canvas => {
    const link = document.createElement("a");
    link.download = `rosins-bingo-${playerName}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }).catch(err => {
    console.error("Download fehlgeschlagen:", err);
    alert("Download fehlgeschlagen. Bitte versuche es erneut.");
  });
}

// ── Room ID ──────────────────────────────────────────────────────────────────

function getRoomStorageKey(roomId = currentRoomId) {
  return "rosins_bingo_room_v5_" + roomId;
}

function loadLocalUser() {
  const saved = localStorage.getItem(LOCAL_USER_KEY);
  if (saved) localActiveUser = saved;
}

function saveLocalUser(name) {
  localActiveUser = name;
  localStorage.setItem(LOCAL_USER_KEY, name);
}

function initRoomId() {
  const urlParams = new URLSearchParams(window.location.search);
  let roomParam = urlParams.get("room");
  if (!roomParam) {
    roomParam = "rosin" + Math.random().toString(36).substr(2, 5);
    const newUrl = `${location.protocol}//${location.host}${location.pathname}?room=${roomParam}&v=${APP_VERSION}`;
    window.history.replaceState({ path: newUrl }, "", newUrl);
  }
  currentRoomId = roomParam.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ── PeerJS Networking ────────────────────────────────────────────────────────

function initMultiplayerNetwork() {
  if (typeof Peer === "undefined") { updateRoomStatusText("Live: Solomodus", ""); return; }
  if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }

  updateRoomStatusText("Verbinde...", "syncing");
  const cleanId = currentRoomId.replace(/[^a-z0-9]/g, "").slice(0, 15);
  const hostPeerId = "rbh" + cleanId;

  peer = new Peer({ debug: 0 });

  let checkHostTimeout = setTimeout(() => becomeHost(hostPeerId), 1800);

  peer.on("open", () => {
    hostConnection = peer.connect(hostPeerId, { reliable: true });

    hostConnection.on("open", () => {
      clearTimeout(checkHostTimeout);
      isHost = false;
      updateRoomStatusText("Live: Verbunden", "connected");
      if (pendingMutationState) { sendMutationToHost(); pendingMutationState = null; }
    });

    hostConnection.on("data", (data) => {
      if (data && data.type === "SYNC_STATE" && data.state) {
        isApplyingNetworkUpdate = true;
        state = data.state;
        saveState(false);
        renderApp();
        checkAndFireConfetti();
        isApplyingNetworkUpdate = false;
      }
    });

    hostConnection.on("error", () => { clearTimeout(checkHostTimeout); becomeHost(hostPeerId); });
    hostConnection.on("close", () => updateRoomStatusText("Verbindung getrennt", ""));
  });

  peer.on("error", () => { clearTimeout(checkHostTimeout); becomeHost(hostPeerId); });
}

function becomeHost(hostPeerId) {
  if (isHost && peer && peer.id === hostPeerId) return;
  if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }

  isHost = true;
  clientConnections = [];
  peer = new Peer(hostPeerId, { debug: 0 });

  peer.on("open", () => {
    updateRoomStatusText(`Live: Host (1 Spieler)`, "connected");
    setupHostPeerListeners();
    if (pendingMutationState) { broadcastStateToClients(); pendingMutationState = null; }
  });

  peer.on("error", (err) => {
    if (err.type === "unavailable-id") setTimeout(() => initMultiplayerNetwork(), 500);
    else updateRoomStatusText("Live: Solomodus", "");
  });
}

function setupHostPeerListeners() {
  peer.on("connection", (conn) => {
    clientConnections.push(conn);
    updateRoomStatusText(`Live: Host (${1 + clientConnections.length} Spieler)`, "connected");

    conn.on("open", () => conn.send({ type: "SYNC_STATE", state }));

    conn.on("data", (data) => {
      if (data && data.type === "MUTATE_STATE" && data.state) {
        isApplyingNetworkUpdate = true;
        state = data.state;
        saveState(false);
        renderApp();
        checkAndFireConfetti();
        isApplyingNetworkUpdate = false;
        broadcastStateToClients();
      }
    });

    conn.on("close", () => {
      clientConnections = clientConnections.filter(c => c !== conn);
      updateRoomStatusText(`Live: Host (${1 + clientConnections.length} Spieler)`, "connected");
    });
  });
}

function broadcastStateToClients() {
  clientConnections.forEach(conn => { if (conn.open) conn.send({ type: "SYNC_STATE", state }); });
}

function sendMutationToHost() {
  if (hostConnection && hostConnection.open) hostConnection.send({ type: "MUTATE_STATE", state });
  else pendingMutationState = state;
}

function updateRoomStatusText(text, statusClass) {
  const el = document.getElementById("room-status");
  if (el) { el.textContent = text; el.className = `room-status ${statusClass}`; }

  const helpEl = document.getElementById("settings-host-help");
  const selectGrid = document.getElementById("select-grid-size");
  if (helpEl && selectGrid) {
    if (!isHost) { helpEl.textContent = "Nur der Raum-Host kann die Raster-Größe ändern."; selectGrid.disabled = true; }
    else { helpEl.textContent = "Raster für alle Spielfelder festlegen."; selectGrid.disabled = false; }
  }
}

// ── State Management ─────────────────────────────────────────────────────────

function loadState() {
  const saved = localStorage.getItem(getRoomStorageKey());
  if (saved) {
    try {
      state = JSON.parse(saved);
      if (!state.gridSize) state.gridSize = 4;
      if (!Array.isArray(state.boards) || state.boards.length === 0) {
        state.boards = [createBoard(), createBoard()];
      }
    } catch (e) { createDefaultState(); }
  } else {
    createDefaultState();
  }
}

function createDefaultState() {
  state = { gridSize: 4, boards: [createBoard(), createBoard()] };
  saveState();
}

function saveState(shouldBroadcast = true) {
  localStorage.setItem(getRoomStorageKey(), JSON.stringify(state));
  if (shouldBroadcast && !isApplyingNetworkUpdate) {
    if (isHost) broadcastStateToClients();
    else sendMutationToHost();
  }
}

function createBoard() {
  const totalTiles = state.gridSize * state.gridSize;
  return {
    id: "board_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    playerName: "",
    isLocked: false,
    bgImage: "",
    tiles: Array.from({ length: totalTiles }, (_, i) => ({ id: i, text: "", marked: false }))
  };
}

// ── Rendering ────────────────────────────────────────────────────────────────

function renderApp() {
  document.documentElement.style.setProperty("--grid-size", state.gridSize);
  const selectGrid = document.getElementById("select-grid-size");
  if (selectGrid) selectGrid.value = state.gridSize;

  const userBadge = document.getElementById("active-user-badge");
  const userNameEl = document.getElementById("active-user-name");
  if (localActiveUser) {
    userBadge.classList.remove("hidden");
    userNameEl.textContent = localActiveUser + (isHost ? " (Host)" : "");
  } else {
    userBadge.classList.add("hidden");
  }

  const container = document.getElementById("boards-container");
  container.innerHTML = "";
  state.boards.forEach((board) => container.appendChild(renderBoardCard(board)));

  checkAndFireConfetti();
}

function renderBoardCard(board) {
  const isMine = board.playerName && board.playerName === localActiveUser;
  const isClaimed = Boolean(board.playerName);
  const hasBg = Boolean(board.bgImage);
  const bingoResult = checkBingo(board);

  const card = document.createElement("div");
  card.className = [
    "bingo-board-card",
    isClaimed ? "claimed" : "",
    isMine ? "my-board" : "",
    board.isLocked ? "locked" : "",
    hasBg ? "has-bg-image" : "",
    bingoResult.hasBingo ? "has-bingo" : ""
  ].join(" ").trim();
  card.dataset.boardId = board.id;

  let html = "";

  if (hasBg) {
    html += `<div class="board-bg-layer" style="background-image: url('${encodeURI(board.bgImage)}');"></div>`;
  }

  const lockBtnText = board.isLocked ? "Sperre aufheben" : "Feld sperren";
  const lockBtnClass = board.isLocked ? "btn-secondary" : "btn-primary";
  const canDelete = !isClaimed || isMine || isHost;

  let playerDisplay = isClaimed
    ? `<span class="player-name-badge">${escapeHtml(board.playerName)} <span class="owner-indicator ${isMine ? "is-me" : ""}">${isMine ? "Du" : "Besitzer"}</span></span>`
    : `<button class="unclaimed-badge" data-action="claim-board" data-id="${board.id}">Spielfeld übernehmen</button>`;

  html += `
    <div class="bingo-header">
      <div class="board-player-info">${playerDisplay}</div>
      <div class="board-actions">
        ${isMine ? `
          <button class="btn btn-sm btn-secondary" data-action="open-board-design" data-id="${board.id}">Design</button>
          ${!board.isLocked
            ? `<button class="btn btn-sm btn-secondary" data-action="randomize-board" data-id="${board.id}">Zufall</button>`
            : `<button class="btn btn-sm btn-secondary" data-action="reset-marks" data-id="${board.id}">Neu starten</button>`}
          <button class="btn btn-sm btn-secondary" data-action="release-board" data-id="${board.id}">Freigeben</button>
          <button class="btn btn-sm ${lockBtnClass}" data-action="toggle-lock" data-id="${board.id}">${lockBtnText}</button>
          <button class="btn btn-sm btn-secondary" data-action="download-board" data-id="${board.id}" title="Als Bild herunterladen">Download</button>
        ` : ""}
        ${canDelete ? `<button class="btn btn-sm btn-icon-only btn-delete-board" data-action="delete-board" data-id="${board.id}">&times;</button>` : ""}
      </div>
    </div>
  `;

  if (bingoResult.hasBingo) {
    html += `<div class="bingo-banner">BINGO! BINGO! BINGO!</div>`;
  } else {
    const filledCount = board.tiles.filter(t => t.text.trim()).length;
    const markedCount = board.tiles.filter(t => t.marked).length;
    const total = board.tiles.length;
    let modeText = !isClaimed ? "Freies Feld: Klicke zum Übernehmen"
      : board.isLocked ? `Markiert: ${markedCount}/${total} (Spielmodus)`
      : `Ausgefüllt: ${filledCount}/${total} (Bearbeiten)`;
    html += `<div class="board-subbar"><span>${modeText}</span></div>`;
  }

  html += `<div class="bingo-grid">`;
  board.tiles.forEach((tile, idx) => {
    const isWinner = bingoResult.winningIndices.includes(idx);
    const tileText = tile.text.trim();
    const sizeClass = getFontSizeClass(tileText);
    html += `
      <div class="bingo-tile ${tile.marked ? "marked" : ""} ${!tileText ? "empty" : ""} ${isWinner ? "winning-tile" : ""}"
           data-board-id="${board.id}" data-tile-index="${idx}">
        <div class="tile-content ${sizeClass}">
          ${tileText ? escapeHtml(tileText) : (board.isLocked || !isClaimed ? "" : "+ Text")}
        </div>
      </div>`;
  });
  html += `</div>`;

  card.innerHTML = html;
  return card;
}

function getFontSizeClass(text) {
  const l = text.length;
  if (l === 0) return "size-md";
  if (l <= 8) return "size-xl";
  if (l <= 20) return "size-lg";
  if (l <= 45) return "size-md";
  if (l <= 75) return "size-sm";
  if (l <= 95) return "size-xs";
  return "size-xxs";
}

// ── Bingo Check ──────────────────────────────────────────────────────────────

function checkBingo(board) {
  const n = state.gridSize;
  const tiles = board.tiles;
  let winningIndices = [];
  let hasBingo = false;

  const checkLine = (indices) => {
    if (indices.every(i => tiles[i] && tiles[i].marked)) {
      hasBingo = true;
      winningIndices.push(...indices);
    }
  };

  for (let r = 0; r < n; r++) checkLine(Array.from({ length: n }, (_, c) => r * n + c));
  for (let c = 0; c < n; c++) checkLine(Array.from({ length: n }, (_, r) => r * n + c));
  checkLine(Array.from({ length: n }, (_, i) => i * n + i));
  checkLine(Array.from({ length: n }, (_, i) => i * n + (n - 1 - i)));

  return { hasBingo, winningIndices: [...new Set(winningIndices)] };
}

// ── Event Listeners ──────────────────────────────────────────────────────────

function setupEventListeners() {
  const container = document.getElementById("boards-container");

  container.addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-action]");
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const boardId = actionBtn.dataset.id;
      if (action === "claim-board")        { openClaimModal(boardId); return; }
      if (action === "release-board")      { releaseBoard(boardId); return; }
      if (action === "toggle-lock")        { toggleBoardLock(boardId); return; }
      if (action === "delete-board")       { deleteBoard(boardId); return; }
      if (action === "randomize-board")    { randomizeBoard(boardId); return; }
      if (action === "reset-marks")        { resetMarks(boardId); return; }
      if (action === "open-board-design")  { openBoardDesignModal(boardId); return; }
      if (action === "download-board")     { downloadBoardAsImage(boardId); return; }
    }

    const tileEl = e.target.closest(".bingo-tile");
    if (tileEl) handleTileClick(tileEl.dataset.boardId, parseInt(tileEl.dataset.tileIndex, 10));
  });

  // Dark mode toggle
  document.getElementById("btn-dark-mode").addEventListener("click", toggleDarkMode);

  // Scoreboard
  document.getElementById("btn-scoreboard").addEventListener("click", () => {
    renderScoreboard();
    openModal("modal-scoreboard");
  });

  // Copy room link
  document.getElementById("btn-copy-room").addEventListener("click", () => {
    const url = `${location.protocol}//${location.host}${location.pathname}?room=${currentRoomId}&v=${APP_VERSION}`;
    navigator.clipboard.writeText(url)
      .then(() => alert("Spiel-Link in die Zwischenablage kopiert!"))
      .catch(() => prompt("Kopiere diesen Link für deine Freunde:", url));
  });

  // Room modal
  document.getElementById("btn-join-room-modal").addEventListener("click", () => {
    document.getElementById("input-room-code").value = currentRoomId;
    openModal("modal-join-room");
  });

  document.getElementById("btn-start-new-room").addEventListener("click", () => {
    const newRoom = "rosin" + Math.random().toString(36).substr(2, 5);
    const cleanState = {
      gridSize: 4,
      boards: [
        { id: "board_" + Date.now() + "_1", playerName: "", isLocked: false, bgImage: "",
          tiles: Array.from({ length: 16 }, (_, i) => ({ id: i, text: "", marked: false })) },
        { id: "board_" + Date.now() + "_2", playerName: "", isLocked: false, bgImage: "",
          tiles: Array.from({ length: 16 }, (_, i) => ({ id: i, text: "", marked: false })) }
      ]
    };
    localStorage.setItem(getRoomStorageKey(newRoom), JSON.stringify(cleanState));
    window.location.href = `${location.protocol}//${location.host}${location.pathname}?room=${newRoom}&v=${APP_VERSION}`;
  });

  document.getElementById("btn-confirm-join-room").addEventListener("click", () => {
    const code = document.getElementById("input-room-code").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (code) window.location.href = `${location.protocol}//${location.host}${location.pathname}?room=${code}&v=${APP_VERSION}`;
  });

  // Add board
  document.getElementById("btn-add-board").addEventListener("click", () => {
    state.boards.push(createBoard());
    saveState();
    renderApp();
  });

  // Settings
  document.getElementById("btn-settings").addEventListener("click", () => openModal("modal-settings"));

  document.getElementById("select-grid-size").addEventListener("change", (e) => {
    if (!isHost) { alert("Nur der Raum-Host kann die Raster-Größe ändern."); renderApp(); return; }
    const newSize = parseInt(e.target.value, 10);
    if (newSize !== state.gridSize) {
      state.gridSize = newSize;
      state.boards.forEach(board => {
        const totalTiles = newSize * newSize;
        board.tiles = Array.from({ length: totalTiles }, (_, i) => board.tiles[i] || { id: i, text: "", marked: false });
      });
      saveState();
      renderApp();
    }
  });

  // Reset
  document.getElementById("btn-reset").addEventListener("click", () => {
    if (!isHost) { alert("Nur der Raum-Host kann das gesamte Spiel zurücksetzen."); return; }
    openModal("modal-reset");
  });

  document.getElementById("btn-confirm-reset").addEventListener("click", () => {
    if (!isHost) { closeModal("modal-reset"); return; }
    previousBingoBoards.clear();
    createDefaultState();
    closeModal("modal-reset");
    renderApp();
  });

  // Claim board
  document.getElementById("btn-confirm-claim").addEventListener("click", () => {
    const name = document.getElementById("input-player-name").value.trim();
    if (!name) { alert("Bitte gib einen gültigen Namen ein."); return; }

    const taken = state.boards.find(b => b.id !== claimingBoardId && b.playerName.toLowerCase() === name.toLowerCase());
    if (taken) { alert(`"${name}" besitzt bereits ein Spielfeld!`); return; }

    const myOther = state.boards.find(b => b.id !== claimingBoardId && b.playerName === localActiveUser);
    if (myOther) {
      if (!confirm(`Du besitzt bereits ein Spielfeld. Freigeben und dieses übernehmen?`)) return;
      myOther.playerName = "";
    }

    const board = state.boards.find(b => b.id === claimingBoardId);
    if (board) { board.playerName = name; saveLocalUser(name); saveState(); renderApp(); }
    closeModal("modal-claim");
  });

  // Board design
  document.getElementById("btn-save-board-design").addEventListener("click", () => {
    const board = state.boards.find(b => b.id === designBoardId);
    if (board) { board.bgImage = selectedBgImage; saveState(); renderApp(); }
    closeModal("modal-board-design");
  });

  // Tile edit
  document.getElementById("btn-save-tile").addEventListener("click", saveTileEdit);
  document.getElementById("btn-clear-tile").addEventListener("click", () => {
    document.getElementById("input-tile-text").value = "";
    saveTileEdit();
  });

  // Escape key
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAllModals(); });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  document.getElementById("input-player-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-confirm-claim").click();
  });
}

// ── Board Actions ────────────────────────────────────────────────────────────

function handleTileClick(boardId, tileIdx) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;

  if (!board.playerName) { openClaimModal(boardId); return; }

  if (board.playerName !== localActiveUser) {
    document.getElementById("ownership-warning-text").textContent =
      `Dieses Spielfeld gehört "${board.playerName}". Nur der Besitzer kann es bearbeiten oder abkreuzen!`;
    openModal("modal-ownership");
    return;
  }

  if (board.isLocked) {
    board.tiles[tileIdx].marked = !board.tiles[tileIdx].marked;
    saveState(true);
    renderApp();
    checkAndFireConfetti();
  } else {
    activeBoardId = boardId;
    activeTileIndex = tileIdx;
    document.getElementById("input-tile-text").value = board.tiles[tileIdx]?.text || "";
    renderPresets();
    openModal("modal-tile-edit");
  }
}

function toggleBoardLock(boardId) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;
  if (!board.playerName) { openClaimModal(boardId); return; }
  if (board.playerName !== localActiveUser) {
    document.getElementById("ownership-warning-text").textContent =
      `Dieses Spielfeld gehört "${board.playerName}". Nur der Besitzer kann es sperren!`;
    openModal("modal-ownership");
    return;
  }
  board.isLocked = !board.isLocked;
  saveState();
  renderApp();
}

function openBoardDesignModal(boardId) {
  designBoardId = boardId;
  const board = state.boards.find(b => b.id === boardId);
  selectedBgImage = board?.bgImage || "";

  const container = document.getElementById("franky-options-grid");
  container.innerHTML = "";

  const noneCard = document.createElement("div");
  noneCard.className = `franky-option-card ${selectedBgImage === "" ? "selected" : ""}`;
  noneCard.innerHTML = `<div class="franky-none-placeholder">Kein Bild</div><span class="franky-option-title">Standard</span>`;
  noneCard.addEventListener("click", () => { selectedBgImage = ""; updateSelectedFrankyOption(container, noneCard); });
  container.appendChild(noneCard);

  FRANKY_IMAGES.forEach(img => {
    const card = document.createElement("div");
    card.className = `franky-option-card ${selectedBgImage === img.file ? "selected" : ""}`;
    card.innerHTML = `<img src="${encodeURI(img.file)}" alt="${escapeHtml(img.name)}" class="franky-option-img"><span class="franky-option-title">${escapeHtml(img.name)}</span>`;
    card.addEventListener("click", () => { selectedBgImage = img.file; updateSelectedFrankyOption(container, card); });
    container.appendChild(card);
  });

  openModal("modal-board-design");
}

function updateSelectedFrankyOption(container, selectedCard) {
  container.querySelectorAll(".franky-option-card").forEach(c => c.classList.remove("selected"));
  selectedCard.classList.add("selected");
}

function randomizeBoard(boardId) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board || board.isLocked) return;
  const shuffled = [...ROSIN_PRESETS].sort(() => 0.5 - Math.random());
  board.tiles.forEach((tile, i) => { tile.text = shuffled[i % shuffled.length]; });
  saveState();
  renderApp();
}

function resetMarks(boardId) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;
  if (confirm("Alle roten Markierungen für eine neue Runde zurücksetzen?")) {
    board.tiles.forEach(t => t.marked = false);
    previousBingoBoards.delete(boardId);
    saveState();
    renderApp();
  }
}

function releaseBoard(boardId) {
  const board = state.boards.find(b => b.id === boardId);
  if (board && board.playerName === localActiveUser) {
    if (confirm("Spielfeld wirklich freigeben?")) {
      board.playerName = "";
      saveLocalUser("");
      saveState();
      renderApp();
    }
  }
}

function deleteBoard(boardId) {
  if (state.boards.length <= 1) { alert("Mindestens ein Spielfeld muss verbleiben!"); return; }
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;
  const isClaimed = Boolean(board.playerName);
  const isMine = board.playerName === localActiveUser;
  if (isClaimed && !isMine && !isHost) { alert(`Nur der Raum-Host oder "${board.playerName}" kann dieses aktive Spielfeld löschen.`); return; }
  if (confirm(isClaimed ? `Spielfeld von "${board.playerName}" wirklich löschen?` : "Leeres Spielfeld löschen?")) {
    state.boards = state.boards.filter(b => b.id !== boardId);
    if (isMine) saveLocalUser("");
    saveState();
    renderApp();
  }
}

function saveTileEdit() {
  if (activeBoardId !== null && activeTileIndex !== null) {
    const board = state.boards.find(b => b.id === activeBoardId);
    if (board?.tiles[activeTileIndex]) {
      board.tiles[activeTileIndex].text = document.getElementById("input-tile-text").value;
      saveState();
      renderApp();
    }
  }
  closeModal("modal-tile-edit");
}

function renderPresets() {
  const container = document.getElementById("presets-container");
  container.innerHTML = "";
  ROSIN_PRESETS.forEach(text => {
    const chip = document.createElement("button");
    chip.className = "preset-chip";
    chip.textContent = text;
    chip.type = "button";
    chip.addEventListener("click", () => { document.getElementById("input-tile-text").value = text; });
    container.appendChild(chip);
  });
}

function openClaimModal(boardId) {
  claimingBoardId = boardId;
  const board = state.boards.find(b => b.id === boardId);
  const input = document.getElementById("input-player-name");
  const myOther = state.boards.find(b => b.id !== boardId && b.playerName === localActiveUser);
  input.value = myOther ? "" : (localActiveUser || board?.playerName || "");
  openModal("modal-claim");
  setTimeout(() => input.focus(), 100);
}

// ── Modal Helpers ────────────────────────────────────────────────────────────

function openModal(id) { document.getElementById(id)?.classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id)?.classList.add("hidden"); }
function closeAllModals() { document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden")); }

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
