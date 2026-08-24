/**
 * Rosins Bingo Application Logic - Plain & Strict Ownership Edition
 * Real-Time Multiplayer Sync via PeerJS WebRTC (v1.0.8)
 * New in v1.0.7: Drag & drop tile swapping, fixed-width dark mode button,
 *                scoreboard removed, and a critical fix that stopped joining
 *                players from wiping a running session with their empty board.
 * New in v1.0.8: Restore points -- the host can undo a reset (or a raster
 *                shrink) and push the previous board back to every player.
 */

const APP_VERSION = "1.0.8";

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
  { name: "Frank verführerisch", file: "assets/franky/Frank verführerisch.jpg" },
  { name: "Frank wird von Magier beeindruckt", file: "assets/franky/Frank wird von Magier beeindruckt.webp" },
  { name: "Frank döner", file: "assets/franky/Frank döner.jpg" },
  { name: "Frank schöner Tag am See", file: "assets/franky/Frank schöner Tag am See.avif" },
  { name: "Frank erklärt", file: "assets/franky/Frank erklärt.jpg" },
  { name: "Frank der retter", file: "assets/franky/Frank der retter.jpg" },
  { name: "Kräuterfrank", file: "assets/franky/Kräuterfrank.jpg" }
];

// Shared network state. `rev` is a monotonic revision counter owned by the host:
// a mutation is only accepted if it was built on the current revision, so a
// client can never overwrite state it has never seen.
let state = { rev: 0, gridSize: 4, boards: [] };

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
// A client is only allowed to push changes once it actually holds the room's
// state. Without this, a fresh joiner's empty starter board gets sent to the
// host and wipes the running game.
let isSynced = false;
let syncedRev = -1;

// Tile drag & drop (hold-to-drag, swap on drop)
const DRAG_HOLD_MS = 220;
const DRAG_MOVE_TOLERANCE = 8;
let dragCandidate = null;
let dragHoldTimer = null;
let dragActive = false;
let dragGhost = null;
let dragSourceEl = null;
let dragTargetIndex = null;
let suppressNextTileClick = false;

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

// Mark every existing bingo as "already seen" so a player joining a running
// game does not get a confetti storm for wins that happened before they arrived.
function seedBingoTracking() {
  previousBingoBoards.clear();
  state.boards.forEach(board => {
    if (board.playerName && checkBingo(board).hasBingo) previousBingoBoards.add(board.id);
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

function getHostPeerId() {
  return "rbh" + currentRoomId.replace(/[^a-z0-9]/g, "").slice(0, 15);
}

// Every (re)connection attempt bumps the generation. Callbacks from a peer we
// have since destroyed check it and bail out, so a torn-down connection can no
// longer fire a reconnect and spiral into a loop.
let networkGeneration = 0;

function teardownPeer() {
  networkGeneration++;
  hostConnection = null;
  clientConnections = [];
  if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
  return networkGeneration;
}

function initMultiplayerNetwork() {
  if (typeof Peer === "undefined") {
    // No networking library: run standalone and treat ourselves as authoritative.
    isHost = true;
    isSynced = true;
    updateRoomStatusText("Live: Solomodus", "");
    return;
  }

  const gen = teardownPeer();
  const isCurrent = () => gen === networkGeneration;

  updateRoomStatusText("Verbinde mit Raum...", "syncing");
  const hostPeerId = getHostPeerId();

  peer = new Peer({ debug: 0 });

  const checkHostTimeout = setTimeout(() => {
    if (isCurrent()) becomeHost(hostPeerId);
  }, 1800);

  peer.on("open", () => {
    if (!isCurrent()) return;
    const conn = peer.connect(hostPeerId, { reliable: true });
    hostConnection = conn;

    conn.on("open", () => {
      if (!isCurrent()) return;
      clearTimeout(checkHostTimeout);
      isHost = false;
      // Deliberately send nothing here. We hold no authoritative state yet, so
      // pushing our local board would overwrite the running game. We just wait
      // for the host's SYNC_STATE.
      updateRoomStatusText("Synchronisiere...", "syncing");
    });

    conn.on("data", (data) => {
      if (!isCurrent() || !data) return;
      if (data.type === "SYNC_STATE" && data.state) {
        applyRemoteState(data.state, !isSynced);
        isSynced = true;
        syncedRev = typeof state.rev === "number" ? state.rev : 0;
        updateRoomStatusText("Live: Verbunden", "connected");
      } else if (data.type === "MUTATION_REJECTED") {
        // Sent after the corrective SYNC_STATE, so this notice is what stays.
        updateRoomStatusText("Sync-Konflikt: Aktion bitte wiederholen", "syncing");
      }
    });

    conn.on("error", () => {
      if (!isCurrent()) return;
      clearTimeout(checkHostTimeout);
      becomeHost(hostPeerId);
    });

    conn.on("close", () => {
      if (!isCurrent()) return;
      handleHostConnectionLost();
    });
  });

  peer.on("error", () => {
    if (!isCurrent()) return;
    clearTimeout(checkHostTimeout);
    becomeHost(hostPeerId);
  });
}

// If the host leaves, the room used to die. Retry the handshake instead: either
// another player has taken over as host, or after the timeout we take over
// ourselves -- with the last state we synced, which is the real game state.
function handleHostConnectionLost() {
  if (isHost) return;
  cancelTileDrag();
  hostConnection = null;
  updateRoomStatusText("Host getrennt, verbinde neu...", "syncing");
  // Stagger so several clients do not all claim the host id at the same moment.
  setTimeout(() => initMultiplayerNetwork(), 400 + Math.floor(Math.random() * 1400));
}

function becomeHost(hostPeerId) {
  if (isHost && peer && peer.id === hostPeerId) return;

  const gen = teardownPeer();
  const isCurrent = () => gen === networkGeneration;

  isHost = true;
  isSynced = true; // Our own state is now the authoritative one.
  peer = new Peer(hostPeerId, { debug: 0 });

  peer.on("open", () => {
    if (!isCurrent()) return;
    updateRoomStatusText(`Live: Host (1 Spieler)`, "connected");
    setupHostPeerListeners(isCurrent);
    renderApp();
  });

  peer.on("error", (err) => {
    if (!isCurrent()) return;
    if (err && err.type === "unavailable-id") {
      // Someone else already hosts this room: go back to being a client.
      isHost = false;
      isSynced = false;
      setTimeout(() => { if (isCurrent()) initMultiplayerNetwork(); }, 500);
    } else {
      updateRoomStatusText("Live: Solomodus", "");
    }
  });
}

function setupHostPeerListeners(isCurrent) {
  peer.on("connection", (conn) => {
    if (!isCurrent()) return;
    clientConnections.push(conn);
    updateRoomStatusText(`Live: Host (${1 + clientConnections.length} Spieler)`, "connected");

    conn.on("open", () => {
      if (isCurrent()) conn.send({ type: "SYNC_STATE", state });
    });

    conn.on("data", (data) => {
      if (!isCurrent() || !data || data.type !== "MUTATE_STATE" || !data.state) return;

      // Only accept a mutation that was built on the revision we currently
      // hold. Anything else is blind (a joiner's empty board, or an edit made
      // on an outdated view) and is answered with a fresh sync instead.
      const currentRev = typeof state.rev === "number" ? state.rev : 0;
      if (data.baseRev !== currentRev) {
        if (conn.open) {
          // Correct them first, then tell them, so the notice is not
          // immediately overwritten by the sync it triggers.
          conn.send({ type: "SYNC_STATE", state });
          conn.send({ type: "MUTATION_REJECTED" });
        }
        return;
      }

      const incoming = data.state;
      incoming.rev = currentRev + 1;
      applyRemoteState(incoming, false);
      broadcastStateToClients();
    });

    conn.on("close", () => {
      if (!isCurrent()) return;
      clientConnections = clientConnections.filter(c => c !== conn);
      updateRoomStatusText(`Live: Host (${1 + clientConnections.length} Spieler)`, "connected");
    });
  });
}

// Adopt a state that came off the wire without echoing it back out again.
function applyRemoteState(incoming, isFirstSync) {
  cancelTileDrag();
  isApplyingNetworkUpdate = true;
  state = incoming;
  if (typeof state.rev !== "number") state.rev = 0;
  if (!state.gridSize) state.gridSize = 4;
  if (!Array.isArray(state.boards)) state.boards = [createBoard(), createBoard()];
  saveState(false);
  if (isFirstSync) seedBingoTracking();
  renderApp();
  isApplyingNetworkUpdate = false;
}

function broadcastStateToClients() {
  clientConnections.forEach(conn => { if (conn.open) conn.send({ type: "SYNC_STATE", state }); });
}

function sendMutationToHost() {
  if (hostConnection && hostConnection.open) {
    hostConnection.send({ type: "MUTATE_STATE", state, baseRev: syncedRev });
    // Assume the host accepts, so a second quick edit of our own is not
    // reported as a conflict with our first one. If the host does reject it,
    // the corrective SYNC_STATE resets both the state and the revision.
    syncedRev += 1;
    state.rev = syncedRev;
  } else {
    // Not connected: keep the change locally only. Queueing it would mean
    // replaying a stale state onto the room once we reconnect.
    updateRoomStatusText("Nicht verbunden: Änderung nur lokal", "");
  }
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
      if (typeof state.rev !== "number") state.rev = 0;
      if (!state.gridSize) state.gridSize = 4;
      if (!Array.isArray(state.boards) || state.boards.length === 0) {
        state.boards = [createBoard(), createBoard()];
      }
    } catch (e) { createDefaultState(); }
  } else {
    createDefaultState();
  }
}

// Single source of truth for "a brand new, empty session".
function buildFreshState(gridSize = 4) {
  return { rev: 0, gridSize, boards: [createBoard(gridSize), createBoard(gridSize)] };
}

function createDefaultState() {
  state = buildFreshState(4);
  // Never broadcast a freshly bootstrapped board. This is the starter state of
  // a device that has not seen the room yet; sending it wipes running games.
  saveState(false);
}

// Swap the whole shared state for a new one while carrying the revision line
// forward. Revisions must never go backwards: if a number is recycled, a stale
// mutation still in flight can match it and be accepted as current.
function replaceState(next) {
  next.rev = typeof state.rev === "number" ? state.rev : 0;
  state = next;
}

function saveState(shouldBroadcast = true) {
  localStorage.setItem(getRoomStorageKey(), JSON.stringify(state));
  if (!shouldBroadcast || isApplyingNetworkUpdate) return;

  if (isHost) {
    state.rev = (typeof state.rev === "number" ? state.rev : 0) + 1;
    localStorage.setItem(getRoomStorageKey(), JSON.stringify(state));
    broadcastStateToClients();
  } else if (isSynced) {
    sendMutationToHost();
  } else {
    // Still handshaking: we hold no authoritative state, so we must not push.
    updateRoomStatusText("Synchronisiere, bitte kurz warten...", "syncing");
  }
}

// Guard for anything that mutates the shared game. A client that has not
// received the room state yet must not act, otherwise its changes are made on
// top of a blank board and are lost (or worse) the moment the sync arrives.
function ensureCanMutate() {
  if (isHost || isSynced) return true;
  updateRoomStatusText("Synchronisiere, bitte kurz warten...", "syncing");
  return false;
}

// ── Restore Point (undo a reset) ──────────────────────────────────────────────
//
// Destructive host actions take a snapshot of the board first, so a reset --
// deliberate or accidental -- can be rolled back. The snapshot lives in
// localStorage under the room key, so it also survives closing the tab.

function getBackupStorageKey(roomId = currentRoomId) {
  return "rosins_bingo_backup_v1_" + roomId;
}

// An empty board is not worth offering back, and snapshotting it would replace
// a genuinely valuable restore point (e.g. after two resets in a row).
function hasRestorableContent(candidate) {
  if (!candidate || !Array.isArray(candidate.boards)) return false;
  return candidate.boards.some(board =>
    board.playerName ||
    board.bgImage ||
    (Array.isArray(board.tiles) && board.tiles.some(t => (t.text || "").trim() || t.marked))
  );
}

function saveRestorePoint(reason) {
  if (!hasRestorableContent(state)) return;
  try {
    localStorage.setItem(getBackupStorageKey(), JSON.stringify({
      reason,
      savedAt: Date.now(),
      version: APP_VERSION,
      state: JSON.parse(JSON.stringify(state))
    }));
  } catch (e) { /* storage full or unavailable: the reset still proceeds */ }
  renderRestoreBar();
}

function loadRestorePoint() {
  try {
    const raw = localStorage.getItem(getBackupStorageKey());
    if (!raw) return null;
    const snapshot = JSON.parse(raw);
    return hasRestorableContent(snapshot && snapshot.state) ? snapshot : null;
  } catch (e) { return null; }
}

function clearRestorePoint() {
  localStorage.removeItem(getBackupStorageKey());
  renderRestoreBar();
}

function restoreFromRestorePoint() {
  if (!isHost) { alert("Nur der Raum-Host kann eine frühere Version wiederherstellen."); return; }

  const snapshot = loadRestorePoint();
  if (!snapshot) { alert("Es ist keine frühere Version gespeichert."); return; }

  if (!confirm("Frühere Version wiederherstellen? Der aktuelle Spielstand wird dabei ersetzt.")) return;

  // Continue the revision line rather than jumping back to the snapshot's own.
  replaceState(snapshot.state);
  if (!state.gridSize) state.gridSize = 4;
  if (!Array.isArray(state.boards) || state.boards.length === 0) {
    state.boards = [createBoard(state.gridSize), createBoard(state.gridSize)];
  }

  seedBingoTracking();     // don't replay old wins as fresh confetti
  saveState();             // host path: bumps rev and pushes to every player
  clearRestorePoint();
  renderApp();
  updateRoomStatusText("Frühere Version wiederhergestellt", "connected");
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return "unbekannter Zeitpunkt";
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`;
}

function describeRestorePoint(snapshot) {
  const reasonText = snapshot.reason === "grid-size"
    ? "vor der Änderung der Raster-Größe"
    : "vor dem Zurücksetzen";
  const boards = Array.isArray(snapshot.state.boards) ? snapshot.state.boards : [];
  const players = boards.filter(b => b.playerName).length;
  const marks = boards.reduce(
    (sum, b) => sum + (Array.isArray(b.tiles) ? b.tiles.filter(t => t.marked).length : 0), 0);
  return `Spielstand ${reasonText} (${formatTimeAgo(snapshot.savedAt)}): `
    + `${boards.length} Spielfelder, ${players} Spieler, ${marks} Markierungen.`;
}

function renderRestoreBar() {
  const bar = document.getElementById("restore-bar");
  if (!bar) return;

  const snapshot = loadRestorePoint();
  // Only the host can push a restore out to the room, so only the host is offered it.
  if (!snapshot || !isHost) { bar.classList.add("hidden"); return; }

  const textEl = document.getElementById("restore-bar-text");
  if (textEl) textEl.textContent = describeRestorePoint(snapshot);
  bar.classList.remove("hidden");
}

function createBoard(gridSize = state.gridSize) {
  const totalTiles = gridSize * gridSize;
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
  // Rebuilding the DOM would orphan an in-flight drag.
  cancelTileDrag();

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

  renderRestoreBar();

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
    const dragHint = isMine ? `<span class="drag-hint">Halten &amp; ziehen zum Tauschen</span>` : "";
    html += `<div class="board-subbar"><span>${modeText}</span>${dragHint}</div>`;
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
    // A completed drag is followed by a click on the tile we just dropped.
    if (suppressNextTileClick) { suppressNextTileClick = false; return; }
    if (!ensureCanMutate()) return;

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

  setupTileDragListeners(container);

  // Dark mode toggle
  document.getElementById("btn-dark-mode").addEventListener("click", toggleDarkMode);

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
    localStorage.setItem(getRoomStorageKey(newRoom), JSON.stringify(buildFreshState(4)));
    window.location.href = `${location.protocol}//${location.host}${location.pathname}?room=${newRoom}&v=${APP_VERSION}`;
  });

  document.getElementById("btn-confirm-join-room").addEventListener("click", () => {
    const code = document.getElementById("input-room-code").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (code) window.location.href = `${location.protocol}//${location.host}${location.pathname}?room=${code}&v=${APP_VERSION}`;
  });

  // Add board
  document.getElementById("btn-add-board").addEventListener("click", () => {
    if (!ensureCanMutate()) return;
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
      // Shrinking the raster silently throws away every tile past the new size.
      if (newSize < state.gridSize) saveRestorePoint("grid-size");
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
    saveRestorePoint("reset"); // Snapshot the board before it is thrown away.
    previousBingoBoards.clear();
    replaceState(buildFreshState(4));
    saveState(); // Host reset is intentional and must reach every player.
    closeModal("modal-reset");
    renderApp();
  });

  // Restore point
  document.getElementById("btn-restore-previous").addEventListener("click", restoreFromRestorePoint);

  document.getElementById("btn-dismiss-restore").addEventListener("click", () => {
    if (confirm("Gespeicherte Vorversion endgültig verwerfen?")) clearRestorePoint();
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

  // Escape key: abort a running drag first, otherwise close modals
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (dragActive || dragCandidate) { cancelTileDrag(); return; }
    closeAllModals();
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  document.getElementById("input-player-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") document.getElementById("btn-confirm-claim").click();
  });
}

// ── Tile Drag & Drop (hold to pick up, drop to swap) ─────────────────────────
//
// A short click keeps its old meaning (edit the text, or cross the tile off).
// Holding the pointer down for DRAG_HOLD_MS picks the tile up; dropping it on
// another tile of the same board swaps the two tiles' contents, so dragging
// D4 onto A1 leaves A1's old content sitting on D4. Only the board's owner can
// drag, which is the same rule that already governs clicking.

function setupTileDragListeners(container) {
  container.addEventListener("pointerdown", onTilePointerDown);
  document.addEventListener("pointermove", onTilePointerMove, { passive: false });
  document.addEventListener("pointerup", onTilePointerUp);
  document.addEventListener("pointercancel", cancelTileDrag);
  // A long press on touch would otherwise pop the native context menu.
  container.addEventListener("contextmenu", (e) => {
    if (dragActive || dragCandidate) e.preventDefault();
  });
}

function onTilePointerDown(e) {
  suppressNextTileClick = false;
  clearTileDragCandidate();

  if (e.button !== undefined && e.button !== 0) return;

  const tileEl = e.target.closest(".bingo-tile");
  if (!tileEl) return;

  const boardId = tileEl.dataset.boardId;
  const index = parseInt(tileEl.dataset.tileIndex, 10);
  const board = state.boards.find(b => b.id === boardId);
  // Owner-only, and never while we are still waiting for the room state.
  if (!board || !board.playerName || board.playerName !== localActiveUser) return;
  if (!isHost && !isSynced) return;

  dragCandidate = { boardId, index, el: tileEl, startX: e.clientX, startY: e.clientY };
  dragHoldTimer = setTimeout(() => beginTileDrag(e.clientX, e.clientY), DRAG_HOLD_MS);
}

function onTilePointerMove(e) {
  if (dragCandidate && !dragActive) {
    // Moving before the hold completes means this is a scroll or a stray
    // wobble, not a pick-up.
    const dx = Math.abs(e.clientX - dragCandidate.startX);
    const dy = Math.abs(e.clientY - dragCandidate.startY);
    if (dx > DRAG_MOVE_TOLERANCE || dy > DRAG_MOVE_TOLERANCE) clearTileDragCandidate();
    return;
  }
  if (!dragActive) return;

  e.preventDefault();
  positionDragGhost(e.clientX, e.clientY);
  updateTileDropTarget(e.clientX, e.clientY);
}

function onTilePointerUp(e) {
  if (!dragActive) { clearTileDragCandidate(); return; }
  finishTileDrag(e.clientX, e.clientY);
}

function beginTileDrag(clientX, clientY) {
  if (!dragCandidate) return;

  dragActive = true;
  dragSourceEl = dragCandidate.el;
  dragTargetIndex = null;

  dragSourceEl.classList.add("tile-drag-source");
  document.body.classList.add("is-dragging-tile");

  const rect = dragSourceEl.getBoundingClientRect();
  dragGhost = dragSourceEl.cloneNode(true);
  dragGhost.classList.add("tile-drag-ghost");
  dragGhost.classList.remove("tile-drag-source");
  dragGhost.style.width = `${rect.width}px`;
  dragGhost.style.height = `${rect.height}px`;
  dragGhost.dataset.ghostOffsetX = String(clientX - rect.left);
  dragGhost.dataset.ghostOffsetY = String(clientY - rect.top);
  document.body.appendChild(dragGhost);

  positionDragGhost(clientX, clientY);
}

function positionDragGhost(clientX, clientY) {
  if (!dragGhost) return;
  const offsetX = parseFloat(dragGhost.dataset.ghostOffsetX) || 0;
  const offsetY = parseFloat(dragGhost.dataset.ghostOffsetY) || 0;
  dragGhost.style.left = `${clientX - offsetX}px`;
  dragGhost.style.top = `${clientY - offsetY}px`;
}

// Resolve what is under the pointer. The ghost has pointer-events: none, so it
// does not shadow the tile we are hovering.
function findTileUnderPointer(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  const tileEl = el && el.closest ? el.closest(".bingo-tile") : null;
  if (!tileEl || !dragCandidate) return null;
  // Swapping only makes sense inside one board.
  if (tileEl.dataset.boardId !== dragCandidate.boardId) return null;
  return tileEl;
}

function updateTileDropTarget(clientX, clientY) {
  const tileEl = findTileUnderPointer(clientX, clientY);
  const index = tileEl ? parseInt(tileEl.dataset.tileIndex, 10) : null;

  if (index === dragTargetIndex) return;
  dragTargetIndex = index;

  document.querySelectorAll(".tile-drop-target").forEach(el => el.classList.remove("tile-drop-target"));
  if (tileEl && index !== dragCandidate.index) tileEl.classList.add("tile-drop-target");
}

function finishTileDrag(clientX, clientY) {
  const tileEl = findTileUnderPointer(clientX, clientY);
  const targetIndex = tileEl ? parseInt(tileEl.dataset.tileIndex, 10) : null;
  const boardId = dragCandidate ? dragCandidate.boardId : null;
  const sourceIndex = dragCandidate ? dragCandidate.index : null;

  // Swallow the click that the browser fires right after this pointerup.
  suppressNextTileClick = true;
  cancelTileDrag();

  if (boardId === null || targetIndex === null || targetIndex === sourceIndex) return;
  swapTiles(boardId, sourceIndex, targetIndex);
}

function swapTiles(boardId, sourceIndex, targetIndex) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;
  // Re-check ownership: the state may have changed while the tile was in hand.
  if (!board.playerName || board.playerName !== localActiveUser) return;

  const source = board.tiles[sourceIndex];
  const target = board.tiles[targetIndex];
  if (!source || !target) return;

  // Swap the contents, not the tile objects: `id` stays equal to the grid
  // position so indices and ids never drift apart.
  const carried = { text: source.text, marked: source.marked };
  source.text = target.text;
  source.marked = target.marked;
  target.text = carried.text;
  target.marked = carried.marked;

  saveState();
  renderApp();
}

function clearTileDragCandidate() {
  if (dragHoldTimer) { clearTimeout(dragHoldTimer); dragHoldTimer = null; }
  dragCandidate = null;
}

function cancelTileDrag() {
  clearTileDragCandidate();
  if (!dragActive) return;

  dragActive = false;
  dragTargetIndex = null;
  if (dragGhost && dragGhost.parentNode) dragGhost.parentNode.removeChild(dragGhost);
  dragGhost = null;
  if (dragSourceEl) dragSourceEl.classList.remove("tile-drag-source");
  dragSourceEl = null;
  document.body.classList.remove("is-dragging-tile");
  document.querySelectorAll(".tile-drop-target").forEach(el => el.classList.remove("tile-drop-target"));
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
