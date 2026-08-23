/**
 * Rosins Bingo Application Logic - Plain & Strict Ownership Edition
 * Real-Time Multiplayer Sync via PeerJS WebRTC (v1.0.4)
 */

const APP_VERSION = "1.0.4";

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

// Available Franky background images in assets/franky/
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

// Network Shared State (Grid Size and Boards only)
let state = {
  gridSize: 4,
  boards: []
};

// Purely Local Device User Identity (NEVER synced over network)
let localActiveUser = "";

// UI State for Modal Operations
let activeBoardId = null;
let activeTileIndex = null;
let claimingBoardId = null;
let designBoardId = null;
let selectedBgImage = "";

const LOCAL_STORAGE_KEY = "rosins_bingo_shared_state_v4";
const LOCAL_USER_KEY = "rosins_bingo_local_user_v4";

// Multiplayer PeerJS Variables
let currentRoomId = "";
let peer = null;
let isHost = false;
let hostConnection = null;
let clientConnections = [];
let isApplyingNetworkUpdate = false;
let pendingMutationState = null;

document.addEventListener("DOMContentLoaded", () => {
  initRoomId();
  loadLocalUser();
  loadState();
  renderApp();
  setupEventListeners();
  initMultiplayerNetwork();
});

function loadLocalUser() {
  const savedUser = localStorage.getItem(LOCAL_USER_KEY);
  if (savedUser) {
    localActiveUser = savedUser;
  }
}

function saveLocalUser(name) {
  localActiveUser = name;
  localStorage.setItem(LOCAL_USER_KEY, name);
}

// Initialize or parse Room ID from URL
function initRoomId() {
  const urlParams = new URLSearchParams(window.location.search);
  let roomParam = urlParams.get("room");

  if (!roomParam) {
    roomParam = "rosin" + Math.random().toString(36).substr(2, 5);
    const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + "?room=" + roomParam + "&v=" + APP_VERSION;
    window.history.replaceState({ path: newUrl }, "", newUrl);
  }
  currentRoomId = roomParam.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Fail-proof PeerJS Real-Time Multiplayer Networking
function initMultiplayerNetwork() {
  if (typeof Peer === "undefined") {
    updateRoomStatusText("Live: Solomodus", "");
    return;
  }

  if (peer) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }

  updateRoomStatusText("Verbinde...", "syncing");
  const cleanId = currentRoomId.replace(/[^a-z0-9]/g, "").slice(0, 15);
  const hostPeerId = "rbh" + cleanId;

  // Step 1: Connect as Client first to see if Host is active
  peer = new Peer({ debug: 0 });

  let checkHostTimeout = setTimeout(() => {
    becomeHost(hostPeerId);
  }, 1800);

  peer.on("open", () => {
    hostConnection = peer.connect(hostPeerId, { reliable: true });

    hostConnection.on("open", () => {
      clearTimeout(checkHostTimeout);
      isHost = false;
      updateRoomStatusText("Live: Verbunden", "connected");

      if (pendingMutationState) {
        sendMutationToHost();
        pendingMutationState = null;
      }
    });

    hostConnection.on("data", (data) => {
      if (data && data.type === "SYNC_STATE" && data.state) {
        isApplyingNetworkUpdate = true;
        state = data.state;
        saveState(false);
        renderApp();
        isApplyingNetworkUpdate = false;
      }
    });

    hostConnection.on("error", () => {
      clearTimeout(checkHostTimeout);
      becomeHost(hostPeerId);
    });

    hostConnection.on("close", () => {
      updateRoomStatusText("Verbindung getrennt", "");
    });
  });

  peer.on("error", () => {
    clearTimeout(checkHostTimeout);
    becomeHost(hostPeerId);
  });
}

function becomeHost(hostPeerId) {
  if (isHost && peer && peer.id === hostPeerId) return;

  if (peer) {
    try { peer.destroy(); } catch (e) {}
    peer = null;
  }

  isHost = true;
  clientConnections = [];

  peer = new Peer(hostPeerId, { debug: 0 });

  peer.on("open", () => {
    updateRoomStatusText(`Live: Host (${1} Spieler)`, "connected");
    setupHostPeerListeners();

    if (pendingMutationState) {
      broadcastStateToClients();
      pendingMutationState = null;
    }
  });

  peer.on("error", (err) => {
    if (err.type === "unavailable-id") {
      setTimeout(() => initMultiplayerNetwork(), 500);
    } else {
      updateRoomStatusText("Live: Solomodus", "");
    }
  });
}

function setupHostPeerListeners() {
  peer.on("connection", (conn) => {
    clientConnections.push(conn);
    updateRoomStatusText(`Live: Host (${1 + clientConnections.length} Spieler)`, "connected");

    conn.on("open", () => {
      conn.send({ type: "SYNC_STATE", state: state });
    });

    conn.on("data", (data) => {
      if (data && data.type === "MUTATE_STATE" && data.state) {
        isApplyingNetworkUpdate = true;
        state = data.state;
        saveState(false);
        renderApp();
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
  clientConnections.forEach(conn => {
    if (conn.open) {
      conn.send({ type: "SYNC_STATE", state: state });
    }
  });
}

function sendMutationToHost() {
  if (hostConnection && hostConnection.open) {
    hostConnection.send({ type: "MUTATE_STATE", state: state });
  } else {
    pendingMutationState = state;
  }
}

function updateRoomStatusText(text, statusClass) {
  const statusEl = document.getElementById("room-status");
  if (statusEl) {
    statusEl.textContent = text;
    statusEl.className = `room-status ${statusClass}`;
  }

  // Update Settings modal help text if not Host
  const helpEl = document.getElementById("settings-host-help");
  const selectGrid = document.getElementById("select-grid-size");
  if (helpEl && selectGrid) {
    if (!isHost) {
      helpEl.textContent = "Nur der Raum-Host kann die Raster-Größe ändern.";
      selectGrid.disabled = true;
    } else {
      helpEl.textContent = "Raster für alle Spielfelder festlegen.";
      selectGrid.disabled = false;
    }
  }
}

// Load state from localStorage or create default
function loadState() {
  const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (saved) {
    try {
      state = JSON.parse(saved);
      if (!state.gridSize) state.gridSize = 4;
      if (!Array.isArray(state.boards) || state.boards.length === 0) {
        state.boards = [createBoard(1), createBoard(2)];
      }
    } catch (e) {
      console.error("Failed to parse saved state", e);
      createDefaultState();
    }
  } else {
    createDefaultState();
  }
}

function createDefaultState() {
  state = {
    gridSize: 4,
    boards: [createBoard(1), createBoard(2)]
  };
  saveState();
}

function saveState(shouldBroadcast = true) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));

  if (shouldBroadcast && !isApplyingNetworkUpdate) {
    if (isHost) {
      broadcastStateToClients();
    } else {
      sendMutationToHost();
    }
  }
}

function createBoard(number = 1) {
  const totalTiles = state.gridSize * state.gridSize;
  const tiles = [];
  for (let i = 0; i < totalTiles; i++) {
    tiles.push({
      id: i,
      text: "",
      marked: false
    });
  }

  return {
    id: "board_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    playerName: "",
    isLocked: false,
    bgImage: "",
    tiles: tiles
  };
}

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

  state.boards.forEach((board, index) => {
    const card = renderBoardCard(board, index);
    container.appendChild(card);
  });
}

function renderBoardCard(board, index) {
  const isMine = board.playerName && board.playerName === localActiveUser;
  const isClaimed = Boolean(board.playerName);
  const hasBg = Boolean(board.bgImage);

  const card = document.createElement("div");
  card.className = `bingo-board-card ${isClaimed ? "claimed" : ""} ${isMine ? "my-board" : ""} ${board.isLocked ? "locked" : ""} ${hasBg ? "has-bg-image" : ""}`;
  card.dataset.boardId = board.id;

  const bingoResult = checkBingo(board);
  if (bingoResult.hasBingo) {
    card.classList.add("has-bingo");
  }

  let playerDisplay = "";
  if (isClaimed) {
    const isMeTag = isMine ? `<span class="owner-indicator is-me">Du</span>` : `<span class="owner-indicator">Besitzer</span>`;
    playerDisplay = `
      <span class="player-name-badge" title="Spieler">
        ${escapeHtml(board.playerName)} ${isMeTag}
      </span>
    `;
  } else {
    playerDisplay = `
      <button class="unclaimed-badge" data-action="claim-board" data-id="${board.id}">
        Spielfeld übernehmen
      </button>
    `;
  }

  const lockButtonText = board.isLocked ? "Sperre aufheben" : "Feld sperren";
  const lockButtonClass = board.isLocked ? "btn-secondary" : "btn-primary";

  const canDelete = !isClaimed || isMine || isHost;

  let html = "";

  if (board.bgImage) {
    html += `<div class="board-bg-layer" style="background-image: url('${encodeURI(board.bgImage)}');"></div>`;
  }

  html += `
    <div class="bingo-header">
      <div class="board-player-info">
        ${playerDisplay}
      </div>
      <div class="board-actions">
        ${isClaimed && isMine ? `
          <button class="btn btn-sm btn-secondary" data-action="open-board-design" data-id="${board.id}" title="Hintergrundbild wählen">
            Design
          </button>
          ${!board.isLocked ? `
            <button class="btn btn-sm btn-secondary" data-action="randomize-board" data-id="${board.id}" title="Zufällige Rosin-Begriffe ausfüllen">
              Zufall
            </button>
          ` : `
            <button class="btn btn-sm btn-secondary" data-action="reset-marks" data-id="${board.id}" title="Alle Markierungen zurücksetzen">
              Neu starten
            </button>
          `}
          <button class="btn btn-sm btn-secondary" data-action="release-board" data-id="${board.id}" title="Spielfeld freigeben">
            Freigeben
          </button>
          <button class="btn btn-sm ${lockButtonClass}" data-action="toggle-lock" data-id="${board.id}">
            ${lockButtonText}
          </button>
        ` : ''}
        ${canDelete ? `
          <button class="btn btn-sm btn-icon-only btn-delete-board" data-action="delete-board" data-id="${board.id}" title="Spielfeld löschen">
            &times;
          </button>
        ` : ''}
      </div>
    </div>
  `;

  if (bingoResult.hasBingo) {
    html += `
      <div class="bingo-banner">
        BINGO! BINGO! BINGO!
      </div>
    `;
  } else {
    const filledCount = board.tiles.filter(t => t.text.trim() !== "").length;
    const totalCount = board.tiles.length;
    const markedCount = board.tiles.filter(t => t.marked).length;

    let modeText = "";
    if (!isClaimed) {
      modeText = "Freies Feld: Klicke zum Übernehmen";
    } else if (board.isLocked) {
      modeText = `Markiert: ${markedCount}/${totalCount} (Spielmodus)`;
    } else {
      modeText = `Ausgefüllt: ${filledCount}/${totalCount} (Bearbeiten)`;
    }

    html += `
      <div class="board-subbar">
        <span>${modeText}</span>
      </div>
    `;
  }

  html += `<div class="bingo-grid">`;
  
  board.tiles.forEach((tile, idx) => {
    const isWinningTile = bingoResult.winningIndices.includes(idx);
    const tileText = tile.text.trim();
    const sizeClass = getFontSizeClass(tileText);
    const isEmpty = tileText === "";

    html += `
      <div class="bingo-tile ${tile.marked ? "marked" : ""} ${isEmpty ? "empty" : ""} ${isWinningTile ? "winning-tile" : ""}"
           data-board-id="${board.id}" 
           data-tile-index="${idx}">
        <div class="tile-content ${sizeClass}">
          ${isEmpty ? (board.isLocked || !isClaimed ? "" : "+ Text") : escapeHtml(tileText)}
        </div>
      </div>
    `;
  });

  html += `</div>`;

  card.innerHTML = html;
  return card;
}

function getFontSizeClass(text) {
  const len = text.length;
  if (len === 0) return "size-md";
  if (len <= 8) return "size-xl";
  if (len <= 20) return "size-lg";
  if (len <= 45) return "size-md";
  if (len <= 75) return "size-sm";
  if (len <= 95) return "size-xs";
  return "size-xxs";
}

function checkBingo(board) {
  const n = state.gridSize;
  const tiles = board.tiles;
  let winningIndices = [];
  let hasBingo = false;

  for (let r = 0; r < n; r++) {
    let rowIndices = [];
    let rowMarked = true;
    for (let c = 0; c < n; c++) {
      const idx = r * n + c;
      rowIndices.push(idx);
      if (!tiles[idx] || !tiles[idx].marked) {
        rowMarked = false;
      }
    }
    if (rowMarked) {
      hasBingo = true;
      winningIndices.push(...rowIndices);
    }
  }

  for (let c = 0; c < n; c++) {
    let colIndices = [];
    let colMarked = true;
    for (let r = 0; r < n; r++) {
      const idx = r * n + c;
      colIndices.push(idx);
      if (!tiles[idx] || !tiles[idx].marked) {
        colMarked = false;
      }
    }
    if (colMarked) {
      hasBingo = true;
      winningIndices.push(...colIndices);
    }
  }

  let diag1Indices = [];
  let diag1Marked = true;
  for (let i = 0; i < n; i++) {
    const idx = i * n + i;
    diag1Indices.push(idx);
    if (!tiles[idx] || !tiles[idx].marked) {
      diag1Marked = false;
    }
  }
  if (diag1Marked) {
    hasBingo = true;
    winningIndices.push(...diag1Indices);
  }

  let diag2Indices = [];
  let diag2Marked = true;
  for (let i = 0; i < n; i++) {
    const idx = i * n + (n - 1 - i);
    diag2Indices.push(idx);
    if (!tiles[idx] || !tiles[idx].marked) {
      diag2Marked = false;
    }
  }
  if (diag2Marked) {
    hasBingo = true;
    winningIndices.push(...diag2Indices);
  }

  return {
    hasBingo,
    winningIndices: [...new Set(winningIndices)]
  };
}

function setupEventListeners() {
  const container = document.getElementById("boards-container");

  container.addEventListener("click", (e) => {
    const target = e.target;

    const actionBtn = target.closest("[data-action]");
    if (actionBtn) {
      const action = actionBtn.dataset.action;
      const boardId = actionBtn.dataset.id;

      if (action === "claim-board") {
        openClaimModal(boardId);
        return;
      } else if (action === "release-board") {
        releaseBoard(boardId);
        return;
      } else if (action === "toggle-lock") {
        toggleBoardLock(boardId);
        return;
      } else if (action === "delete-board") {
        deleteBoard(boardId);
        return;
      } else if (action === "randomize-board") {
        randomizeBoard(boardId);
        return;
      } else if (action === "reset-marks") {
        resetMarks(boardId);
        return;
      } else if (action === "open-board-design") {
        openBoardDesignModal(boardId);
        return;
      }
    }

    const tileEl = target.closest(".bingo-tile");
    if (tileEl) {
      const boardId = tileEl.dataset.boardId;
      const tileIdx = parseInt(tileEl.dataset.tileIndex, 10);
      handleTileClick(boardId, tileIdx);
    }
  });

  // Copy Room Share Link
  document.getElementById("btn-copy-room").addEventListener("click", () => {
    const shareUrl = window.location.protocol + "//" + window.location.host + window.location.pathname + "?room=" + currentRoomId + "&v=" + APP_VERSION;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert("Spiel-Link in die Zwischenablage kopiert! Sende den Link deinen Freunden.");
    }).catch(err => {
      prompt("Kopiere diesen Link für deine Freunde:", shareUrl);
    });
  });

  // Join Room Modal Open
  document.getElementById("btn-join-room-modal").addEventListener("click", () => {
    document.getElementById("input-room-code").value = currentRoomId;
    openModal("modal-join-room");
  });

  // Start Brand New Room Session
  document.getElementById("btn-start-new-room").addEventListener("click", () => {
    const newRoom = "rosin" + Math.random().toString(36).substr(2, 5);
    window.location.href = window.location.protocol + "//" + window.location.host + window.location.pathname + "?room=" + newRoom + "&v=" + APP_VERSION;
  });

  // Confirm Join Existing Room
  document.getElementById("btn-confirm-join-room").addEventListener("click", () => {
    const code = document.getElementById("input-room-code").value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (code) {
      window.location.href = window.location.protocol + "//" + window.location.host + window.location.pathname + "?room=" + code + "&v=" + APP_VERSION;
    }
  });

  // Add Board
  document.getElementById("btn-add-board").addEventListener("click", () => {
    const newBoard = createBoard(state.boards.length + 1);
    state.boards.push(newBoard);
    saveState();
    renderApp();
  });

  // Settings
  document.getElementById("btn-settings").addEventListener("click", () => {
    openModal("modal-settings");
  });

  document.getElementById("select-grid-size").addEventListener("change", (e) => {
    if (!isHost) {
      alert("Nur der Raum-Host kann die Raster-Größe ändern.");
      renderApp();
      return;
    }
    const newSize = parseInt(e.target.value, 10);
    if (newSize !== state.gridSize) {
      state.gridSize = newSize;
      state.boards.forEach(board => {
        const totalTiles = newSize * newSize;
        const newTiles = [];
        for (let i = 0; i < totalTiles; i++) {
          newTiles.push(board.tiles[i] || { id: i, text: "", marked: false });
        }
        board.tiles = newTiles;
      });
      saveState();
      renderApp();
    }
  });

  // Reset (Host-Only Permission)
  document.getElementById("btn-reset").addEventListener("click", () => {
    if (!isHost) {
      alert("Nur der Raum-Host kann das gesamte Spiel zurücksetzen.");
      return;
    }
    openModal("modal-reset");
  });

  document.getElementById("btn-confirm-reset").addEventListener("click", () => {
    if (!isHost) {
      alert("Nur der Raum-Host kann das gesamte Spiel zurücksetzen.");
      closeModal("modal-reset");
      return;
    }
    createDefaultState();
    closeModal("modal-reset");
    renderApp();
  });

  // Confirm Claim with 1-board-per-user restriction
  document.getElementById("btn-confirm-claim").addEventListener("click", () => {
    const input = document.getElementById("input-player-name");
    const name = input.value.trim();

    if (!name) {
      alert("Bitte gib einen gültigen Namen ein.");
      return;
    }

    const existingBoard = state.boards.find(b => b.id !== claimingBoardId && b.playerName.toLowerCase() === name.toLowerCase());
    if (existingBoard) {
      alert(`Der Name "${name}" besitzt bereits ein anderes Spielfeld. Jeder Spieler kann nur 1 Spielfeld gleichzeitig besitzen!`);
      return;
    }

    const currentOwnedBoard = state.boards.find(b => b.id !== claimingBoardId && b.playerName && b.playerName === localActiveUser);
    if (currentOwnedBoard) {
      const confirmSwitch = confirm(`Du (${localActiveUser}) besitzt bereits ein Spielfeld. Möchtest du dein altes Spielfeld freigeben, um dieses neue Spielfeld zu übernehmen?`);
      if (confirmSwitch) {
        currentOwnedBoard.playerName = "";
      } else {
        return;
      }
    }

    if (claimingBoardId) {
      const board = state.boards.find(b => b.id === claimingBoardId);
      if (board) {
        board.playerName = name;
        saveLocalUser(name);
        saveState();
        renderApp();
      }
    }
    closeModal("modal-claim");
  });

  // Save Board Background Design
  document.getElementById("btn-save-board-design").addEventListener("click", () => {
    if (designBoardId) {
      const board = state.boards.find(b => b.id === designBoardId);
      if (board) {
        board.bgImage = selectedBgImage;
        saveState();
        renderApp();
      }
    }
    closeModal("modal-board-design");
  });

  // Save Tile
  document.getElementById("btn-save-tile").addEventListener("click", () => {
    saveTileEdit();
  });

  // Clear Tile Text Button
  document.getElementById("btn-clear-tile").addEventListener("click", () => {
    document.getElementById("input-tile-text").value = "";
    saveTileEdit();
  });

  // Close modals on Escape key press
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllModals();
    }
  });

  document.querySelectorAll("[data-close]").forEach(btn => {
    btn.addEventListener("click", () => {
      closeModal(btn.dataset.close);
    });
  });

  document.getElementById("input-player-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      document.getElementById("btn-confirm-claim").click();
    }
  });
}

function handleTileClick(boardId, tileIdx) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;

  if (!board.playerName) {
    openClaimModal(boardId);
    return;
  }

  // Strict Ownership: Only the claimed owner can edit or mark!
  if (board.playerName !== localActiveUser) {
    document.getElementById("ownership-warning-text").textContent = 
      `Dieses Spielfeld gehört "${board.playerName}". Nur der Besitzer kann dieses Bingo-Feld bearbeiten oder abkreuzen!`;
    openModal("modal-ownership");
    return;
  }

  if (board.isLocked) {
    if (board.tiles[tileIdx]) {
      board.tiles[tileIdx].marked = !board.tiles[tileIdx].marked;
      saveState(true);
      renderApp();
    }
  } else {
    activeBoardId = boardId;
    activeTileIndex = tileIdx;
    
    const tileText = board.tiles[tileIdx] ? board.tiles[tileIdx].text : "";
    document.getElementById("input-tile-text").value = tileText;

    renderPresets();
    openModal("modal-tile-edit");
  }
}

function toggleBoardLock(boardId) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;

  if (!board.playerName) {
    openClaimModal(boardId);
    return;
  }

  if (board.playerName !== localActiveUser) {
    document.getElementById("ownership-warning-text").textContent = 
      `Dieses Spielfeld gehört "${board.playerName}". Nur der Besitzer kann das Spielfeld sperren oder entsperren!`;
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
  selectedBgImage = board ? (board.bgImage || "") : "";

  const container = document.getElementById("franky-options-grid");
  container.innerHTML = "";

  const noneCard = document.createElement("div");
  noneCard.className = `franky-option-card ${selectedBgImage === "" ? "selected" : ""}`;
  noneCard.innerHTML = `
    <div class="franky-none-placeholder">Kein Bild</div>
    <span class="franky-option-title">Standard</span>
  `;
  noneCard.addEventListener("click", () => {
    selectedBgImage = "";
    updateSelectedFrankyOption(container, noneCard);
  });
  container.appendChild(noneCard);

  FRANKY_IMAGES.forEach(img => {
    const card = document.createElement("div");
    card.className = `franky-option-card ${selectedBgImage === img.file ? "selected" : ""}`;
    card.innerHTML = `
      <img src="${encodeURI(img.file)}" alt="${escapeHtml(img.name)}" class="franky-option-img">
      <span class="franky-option-title">${escapeHtml(img.name)}</span>
    `;
    card.addEventListener("click", () => {
      selectedBgImage = img.file;
      updateSelectedFrankyOption(container, card);
    });
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
  board.tiles.forEach((tile, index) => {
    tile.text = shuffled[index % shuffled.length];
  });

  saveState();
  renderApp();
}

function resetMarks(boardId) {
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;

  if (confirm("Möchtest du alle roten Markierungen für eine neue Runde zurücksetzen?")) {
    board.tiles.forEach(t => t.marked = false);
    saveState();
    renderApp();
  }
}

function releaseBoard(boardId) {
  const board = state.boards.find(b => b.id === boardId);
  if (board && board.playerName === localActiveUser) {
    if (confirm(`Möchtest du dein Spielfeld wirklich freigeben?`)) {
      board.playerName = "";
      saveLocalUser("");
      saveState();
      renderApp();
    }
  }
}

function saveTileEdit() {
  if (activeBoardId && activeTileIndex !== null) {
    const board = state.boards.find(b => b.id === activeBoardId);
    if (board && board.tiles[activeTileIndex]) {
      const text = document.getElementById("input-tile-text").value;
      board.tiles[activeTileIndex].text = text;
      saveState();
      renderApp();
    }
  }
  closeModal("modal-tile-edit");
}

function renderPresets() {
  const container = document.getElementById("presets-container");
  container.innerHTML = "";

  ROSIN_PRESETS.forEach(presetText => {
    const chip = document.createElement("button");
    chip.className = "preset-chip";
    chip.textContent = presetText;
    chip.type = "button";
    chip.addEventListener("click", () => {
      document.getElementById("input-tile-text").value = presetText;
    });
    container.appendChild(chip);
  });
}

function deleteBoard(boardId) {
  if (state.boards.length <= 1) {
    alert("Du musst mindestens ein Spielfeld behalten!");
    return;
  }
  
  const board = state.boards.find(b => b.id === boardId);
  if (!board) return;

  const isClaimed = Boolean(board.playerName);
  const isMine = board.playerName === localActiveUser;

  if (isClaimed && !isMine && !isHost) {
    alert(`Nur der Raum-Host oder "${board.playerName}" kann dieses aktive Spielfeld löschen.`);
    return;
  }

  const confirmMsg = isClaimed 
    ? `Möchtest du das Spielfeld von "${board.playerName}" wirklich löschen?`
    : "Möchtest du dieses leere Spielfeld wirklich löschen?";

  if (confirm(confirmMsg)) {
    state.boards = state.boards.filter(b => b.id !== boardId);
    if (isMine) {
      saveLocalUser("");
    }
    saveState();
    renderApp();
  }
}

function openClaimModal(boardId) {
  claimingBoardId = boardId;
  const board = state.boards.find(b => b.id === boardId);
  const input = document.getElementById("input-player-name");

  const ownedBoard = state.boards.find(b => b.id !== boardId && b.playerName && b.playerName === localActiveUser);
  if (ownedBoard) {
    input.value = "";
  } else {
    input.value = localActiveUser || (board ? board.playerName : "");
  }

  openModal("modal-claim");
  setTimeout(() => input.focus(), 100);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("hidden");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("hidden");
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.add("hidden"));
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
