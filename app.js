/**
 * Rosins Bingo Application Logic - Plain & Strict Ownership Edition
 */

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

// App State
let state = {
  gridSize: 4,
  activeUser: "",
  boards: []
};

// UI State for Modal Operations
let activeBoardId = null;
let activeTileIndex = null;
let claimingBoardId = null;
let designBoardId = null;
let selectedBgImage = "";
let pendingOwnerName = "";

const LOCAL_STORAGE_KEY = "rosins_bingo_state_v3";

document.addEventListener("DOMContentLoaded", () => {
  loadState();
  renderApp();
  setupEventListeners();
});

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
    activeUser: "",
    boards: [createBoard(1), createBoard(2)]
  };
  saveState();
}

function saveState() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
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
  
  if (state.activeUser) {
    userBadge.classList.remove("hidden");
    userNameEl.textContent = state.activeUser;
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
  const isMine = board.playerName && board.playerName === state.activeUser;
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
        <button class="btn btn-sm btn-icon-only btn-delete-board" data-action="delete-board" data-id="${board.id}" title="Spielfeld löschen">
          &times;
        </button>
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

  // Header User Switch
  document.getElementById("btn-switch-user").addEventListener("click", () => {
    openSwitchUserModal();
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

  // Reset
  document.getElementById("btn-reset").addEventListener("click", () => {
    openModal("modal-reset");
  });

  document.getElementById("btn-confirm-reset").addEventListener("click", () => {
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

    const currentOwnedBoard = state.boards.find(b => b.id !== claimingBoardId && b.playerName && b.playerName === state.activeUser);
    if (currentOwnedBoard) {
      const confirmSwitch = confirm(`Du (${state.activeUser}) besitzt bereits ein Spielfeld. Möchtest du dein altes Spielfeld freigeben, um dieses neue Spielfeld zu übernehmen?`);
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
        state.activeUser = name;
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

  // Switch to Owner from Warning Modal
  document.getElementById("btn-switch-to-owner").addEventListener("click", () => {
    if (pendingOwnerName) {
      state.activeUser = pendingOwnerName;
      saveState();
      renderApp();
    }
    closeModal("modal-ownership");
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

  if (board.playerName !== state.activeUser) {
    pendingOwnerName = board.playerName;
    document.getElementById("ownership-warning-text").textContent = 
      `Dieses Spielfeld gehört "${board.playerName}". Jeder Spieler kann nur 1 Spielfeld besitzen und bearbeiten.`;
    openModal("modal-ownership");
    return;
  }

  if (board.isLocked) {
    if (board.tiles[tileIdx]) {
      board.tiles[tileIdx].marked = !board.tiles[tileIdx].marked;
      saveState();
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

  if (board.playerName !== state.activeUser) {
    pendingOwnerName = board.playerName;
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
  if (board && board.playerName === state.activeUser) {
    if (confirm(`Möchtest du dein Spielfeld wirklich freigeben?`)) {
      board.playerName = "";
      state.activeUser = "";
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
  const confirmMsg = board && board.playerName 
    ? `Möchtest du das Spielfeld von "${board.playerName}" wirklich löschen?`
    : "Möchtest du dieses Spielfeld wirklich löschen?";

  if (confirm(confirmMsg)) {
    state.boards = state.boards.filter(b => b.id !== boardId);
    if (board && board.playerName === state.activeUser) {
      state.activeUser = state.boards.find(b => b.playerName)?.playerName || "";
    }
    saveState();
    renderApp();
  }
}

function openClaimModal(boardId) {
  claimingBoardId = boardId;
  const board = state.boards.find(b => b.id === boardId);
  const input = document.getElementById("input-player-name");

  const ownedBoard = state.boards.find(b => b.id !== boardId && b.playerName && b.playerName === state.activeUser);
  if (ownedBoard) {
    input.value = "";
  } else {
    input.value = state.activeUser || (board ? board.playerName : "");
  }

  openModal("modal-claim");
  setTimeout(() => input.focus(), 100);
}

function openSwitchUserModal() {
  const container = document.getElementById("users-list-container");
  container.innerHTML = "";

  const claimedBoards = state.boards.filter(b => b.playerName);
  if (claimedBoards.length === 0) {
    container.innerHTML = "<p>Bisher wurden noch keine Spielfelder übernommen.</p>";
  } else {
    claimedBoards.forEach(board => {
      const card = document.createElement("div");
      card.className = "user-switch-card";
      card.innerHTML = `
        <span>${escapeHtml(board.playerName)}</span>
        ${board.playerName === state.activeUser ? '<span class="owner-indicator is-me">Aktiv</span>' : '<button class="btn btn-sm btn-secondary">Zu Spieler wechseln</button>'}
      `;
      card.addEventListener("click", () => {
        state.activeUser = board.playerName;
        saveState();
        renderApp();
        closeModal("modal-switch-user");
      });
      container.appendChild(card);
    });
  }

  openModal("modal-switch-user");
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
