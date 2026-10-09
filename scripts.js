/**
 * NoteQuickly SPA - JavaScript
 * A modern note-taking application with local storage
 * Developer: Likhit Verma
 */

// ===================================
// STATE MANAGEMENT
// ===================================

let notesApplicationData = JSON.parse(
  localStorage.getItem("notesApplicationData"),
) || { notes: [], isDarkMode: true }; // Dark mode default

let notes = notesApplicationData.notes;
let currentNoteIndex = null;
let darkMode = notesApplicationData.isDarkMode;
let isFullscreen = false;
let draggedNoteIndex = null;
let suppressNoteClick = false;
const isDetachedEditor =
  new URLSearchParams(window.location.search).get("detachedEditor") === "1";
/**
 * Give legacy untitled notes a stable fallback title
 */
function ensureDefaultNoteTitles() {
  let changed = false;

  notes.forEach((note, index) => {
    if (!note.title && !note.defaultTitle) {
      note.defaultTitle = `Note ${index + 1}`;
      changed = true;
    }
  });

  return changed;
}

/**
 * Find the next available fallback title for a newly created note
 */
function getNextDefaultNoteTitle() {
  const noteNumbers = notes
    .map((note) => note.defaultTitle || note.title || "")
    .map((title) => title.match(/^Note (\d+)$/))
    .filter(Boolean)
    .map((match) => Number(match[1]));

  const nextNumber = noteNumbers.length > 0 ? Math.max(...noteNumbers) + 1 : 1;
  return `Note ${nextNumber}`;
}

/**
 * Return the stable title shown for a note
 */
function getNoteDisplayTitle(note, index) {
  return note.title || note.defaultTitle || `Note ${index + 1}`;
}

// ===================================
// INITIALIZATION
// ===================================

/**
 * Initialize application on page load
 */
function init() {
  if (isDetachedEditor) {
    document.body.classList.add("detached-editor-mode");
    document.title = "NoteQuickly Editor";
  }

  if (ensureDefaultNoteTitles()) {
    saveNotes();
  }

  // Set dark mode if enabled
  if (darkMode) {
    document.body.classList.add("dark-mode");
  }

  // Update theme icon
  const themeIcon = document.querySelector(".theme-toggle i");
  if (themeIcon) {
    themeIcon.className = darkMode ? "fas fa-moon" : "fas fa-sun";
  }

  // Create first note if none exist
  if (notes.length === 0) {
    createNote();
  } else {
    openNote(getInitialNoteIndex());
  }

  renderNotes();
  setupKeyboardShortcuts();
  setupEditorLinkBehavior();
  updateWordCount();
}

/**
 * Resolve the note passed to a detached editor, falling back to the first note.
 */
function getInitialNoteIndex() {
  if (!isDetachedEditor) return 0;

  const params = new URLSearchParams(window.location.search);
  const created = params.get("noteCreated");
  const noteIndex = created
    ? notes.findIndex((note) => String(note.created) === created)
    : Number(params.get("noteIndex"));

  return Number.isInteger(noteIndex) &&
    noteIndex >= 0 &&
    noteIndex < notes.length
    ? noteIndex
    : 0;
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", function (e) {
    // F1 - Help
    if (e.key === "F1") {
      e.preventDefault();
      openHelpModal();
    }

    // Ctrl+K - Insert Link
    if (e.ctrlKey && e.key === "k") {
      e.preventDefault();
      insertLink();
    }

    // F11 - Fullscreen
    if (e.key === "F11") {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  // Prevent tab from leaving editor
  document.querySelector(".content").addEventListener("keydown", function (e) {
    if (e.key === "Tab") {
      e.preventDefault();
    }
  });
}

/**
 * Ensure links in the editor open in a new tab
 */
function setupEditorLinkBehavior() {
  const editorBox = document.getElementById("editorBox");
  if (!editorBox) return;

  editorBox.addEventListener("click", function (e) {
    const link = e.target.closest("a");
    if (link) {
      e.preventDefault();
      window.open(link.href, "_blank", "noopener,noreferrer");
    }
  });

  editorBox.addEventListener("input", makeLinksOpenInNewTab);
  editorBox.addEventListener("paste", () =>
    setTimeout(makeLinksOpenInNewTab, 0),
  );
  makeLinksOpenInNewTab();
}

/**
 * Apply target=_blank to links inside the editor
 */
function makeLinksOpenInNewTab() {
  const editorBox = document.getElementById("editorBox");
  if (!editorBox) return;

  editorBox.querySelectorAll("a").forEach((link) => {
    if (!link.getAttribute("target")) {
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    }
  });
}

/**
 * Render notes list in sidebar
 */
function renderNotes() {
  const noteList = document.getElementById("noteList");

  if (notes.length === 0) {
    noteList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i class="fas fa-note-sticky"></i></div>
        <p>No notes yet.<br>Click "New Note" to get started!</p>
      </div>
    `;
    return;
  }

  noteList.innerHTML = "";
  notes.forEach((note, index) => {
    const li = document.createElement("li");
    li.draggable = true;
    li.dataset.noteIndex = index;
    li.setAttribute("aria-grabbed", "false");

    const timestamp = note.modified
      ? formatTimestamp(note.modified)
      : formatTimestamp(note.created || Date.now());

    li.innerHTML = `
      <span class="note-title">${getNoteDisplayTitle(note, index)}</span>
      <span class="note-timestamp"><i class="fas fa-clock"></i> ${timestamp}</span>
      <span class="delete-icon" onclick="confirmDeleteNote(event, ${index})"><i class="fas fa-trash-alt"></i></span>
    `;

    li.onclick = (e) => {
      if (suppressNoteClick) {
        suppressNoteClick = false;
        return;
      }

      if (
        !e.target.classList.contains("delete-icon") &&
        !e.target.classList.contains("fa-trash-alt") &&
        !e.target.closest(".delete-icon")
      ) {
        openNote(index);
      }
    };

    if (index === currentNoteIndex) {
      li.classList.add("active");
    }

    li.addEventListener("dragstart", handleNoteDragStart);
    li.addEventListener("dragover", handleNoteDragOver);
    li.addEventListener("dragleave", handleNoteDragLeave);
    li.addEventListener("drop", handleNoteDrop);
    li.addEventListener("dragend", handleNoteDragEnd);

    noteList.appendChild(li);
  });
}

/**
 * Start dragging a note, unless the delete control was the drag origin
 */
function handleNoteDragStart(event) {
  if (event.target.closest(".delete-icon")) {
    event.preventDefault();
    return;
  }

  const noteItem = event.currentTarget;
  draggedNoteIndex = Number(noteItem.dataset.noteIndex);
  noteItem.classList.add("dragging");
  noteItem.setAttribute("aria-grabbed", "true");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(draggedNoteIndex));
}

/**
 * Show where the dragged note will be inserted
 */
function handleNoteDragOver(event) {
  event.preventDefault();

  const noteItem = event.currentTarget;
  if (
    draggedNoteIndex === null ||
    Number(noteItem.dataset.noteIndex) === draggedNoteIndex
  ) {
    return;
  }

  event.dataTransfer.dropEffect = "move";
  document
    .querySelectorAll("#noteList li.drop-before, #noteList li.drop-after")
    .forEach((item) => item.classList.remove("drop-before", "drop-after"));

  const isAfter =
    event.clientY >
    noteItem.getBoundingClientRect().top + noteItem.offsetHeight / 2;
  noteItem.classList.add(isAfter ? "drop-after" : "drop-before");
}

/**
 * Remove the drop indicator when leaving a note
 */
function handleNoteDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    event.currentTarget.classList.remove("drop-before", "drop-after");
  }
}

/**
 * Reorder the notes array and persist the new order
 */
function handleNoteDrop(event) {
  event.preventDefault();

  const targetNoteIndex = Number(event.currentTarget.dataset.noteIndex);
  if (draggedNoteIndex === null || draggedNoteIndex === targetNoteIndex) {
    return;
  }

  const draggedNote = notes[draggedNoteIndex];
  [notes[draggedNoteIndex], notes[targetNoteIndex]] = [
    notes[targetNoteIndex],
    notes[draggedNoteIndex],
  ];
  currentNoteIndex = notes.indexOf(draggedNote);
  saveNotes();
  suppressNoteClick = true;
  setTimeout(() => {
    suppressNoteClick = false;
  }, 300);
  openNote(currentNoteIndex);
  searchNotes();
}

/**
 * Clear drag state after a drop or cancelled drag
 */
function handleNoteDragEnd(event) {
  event.currentTarget.classList.remove("dragging", "drop-before", "drop-after");
  event.currentTarget.setAttribute("aria-grabbed", "false");
  document
    .querySelectorAll("#noteList li.drop-before, #noteList li.drop-after")
    .forEach((item) => item.classList.remove("drop-before", "drop-after"));
  draggedNoteIndex = null;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

/**
 * Create a new note
 */
function createNote() {
  const newNote = {
    title: "",
    defaultTitle: getNextDefaultNoteTitle(),
    content: "",
    created: Date.now(),
    modified: Date.now(),
  };

  notes.push(newNote);
  currentNoteIndex = notes.length - 1;
  saveNotes();
  renderNotes();
  openNote(currentNoteIndex);

  // Focus on title input
  document.getElementById("currentNoteTitle").focus();
}

/**
 * Open a specific note
 */
function openNote(index) {
  if (index < 0 || index >= notes.length) return;

  currentNoteIndex = index;
  const note = notes[index];

  document.getElementById("editorBox").innerHTML = note.content || "";
  document.getElementById("currentNoteTitle").value = getNoteDisplayTitle(
    note,
    index,
  );

  renderNotes();
  updateWordCount();
}

/**
 * Save note title
 */
function saveNoteTitle() {
  if (currentNoteIndex !== null && currentNoteIndex < notes.length) {
    notes[currentNoteIndex].title =
      document.getElementById("currentNoteTitle").value;
    notes[currentNoteIndex].modified = Date.now();
    saveNotes();
    renderNotes();
    showSaveIndicator();
  }
}

/**
 * Save current note content
 */
function saveCurrentNote() {
  if (currentNoteIndex !== null && currentNoteIndex < notes.length) {
    notes[currentNoteIndex].content =
      document.getElementById("editorBox").innerHTML;
    notes[currentNoteIndex].modified = Date.now();
    saveNotes();
    showSaveIndicator();
  }
}

/**
 * Confirm before deleting note
 */
function confirmDeleteNote(event, index) {
  event.stopPropagation();

  if (
    confirm(
      `Are you sure you want to delete "${getNoteDisplayTitle(notes[index], index)}"?`,
    )
  ) {
    deleteNote(index);
  }
}

/**
 * Delete a note
 */
function deleteNote(index) {
  notes.splice(index, 1);

  if (currentNoteIndex === index) {
    currentNoteIndex = notes.length > 0 ? 0 : null;
  } else if (currentNoteIndex > index) {
    currentNoteIndex--;
  }

  saveNotes();
  renderNotes();

  if (notes.length > 0 && currentNoteIndex !== null) {
    openNote(currentNoteIndex);
  } else if (notes.length === 0) {
    createNote();
  }
}

/**
 * Save notes to localStorage
 */
function saveNotes() {
  notesApplicationData.notes = notes;
  notesApplicationData.isDarkMode = darkMode;
  localStorage.setItem(
    "notesApplicationData",
    JSON.stringify(notesApplicationData),
  );
}

/**
 * Open or close the current editor in a compact, editor-only browser window.
 */
function toggleDetachedEditor() {
  if (isDetachedEditor) {
    window.close();
    return;
  }

  saveCurrentNote();
  saveNoteTitle();

  const detachedUrl = new URL(window.location.href);
  detachedUrl.searchParams.set("detachedEditor", "1");
  detachedUrl.searchParams.set("noteIndex", String(currentNoteIndex));
  if (notes[currentNoteIndex]?.created) {
    detachedUrl.searchParams.set(
      "noteCreated",
      String(notes[currentNoteIndex].created),
    );
  }

  const popup = window.open(
    detachedUrl.href,
    "notequicklyDetachedEditor",
    "popup=yes,width=900,height=700,resizable=yes,scrollbars=yes",
  );

  if (!popup) {
    alert(
      "The editor window was blocked. Allow pop-ups for this site and try again.",
    );
  }
}

/**
 * Hide the formatting toolbar while keeping its restore control available.
 */
function toggleToolbarVisibility() {
  const isHidden = document.body.classList.toggle("toolbar-hidden");
  const button = document.getElementById("toggleToolbarButton");
  const label = isHidden ? "Show Toolbar" : "Hide Toolbar";
 
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", String(isHidden));
  button.querySelector("i").className = isHidden ? "fas fa-eye" : "fas fa-eye-slash";
}

/**
 * Show save indicator
 */
function showSaveIndicator() {
  const indicator = document.getElementById("lastSaved");
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  indicator.textContent = `Saved at ${timeString}`;
  indicator.style.color = "var(--accent-color)";

  setTimeout(() => {
    indicator.style.color = "var(--text-secondary)";
  }, 2000);
}

// ===================================
// TEXT FORMATTING
// ===================================

/**
 * Format text with given command
 */
function formatText(command, value = null) {
  document.execCommand(command, false, value);
  saveCurrentNote();
  updateWordCount();
}

/**
 * Insert hyperlink
 */
function insertLink() {
  const url = prompt("Enter the URL:");
  if (url) {
    const selection = window.getSelection();
    const linkText = selection.toString() || url;

    if (selection.rangeCount > 0) {
      document.execCommand("createLink", false, url);
    } else {
      document.execCommand(
        "insertHTML",
        false,
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`,
      );
    }

    makeLinksOpenInNewTab();
    saveCurrentNote();
  }
}

// ===================================
// UI FEATURES
// ===================================

/**
 * Toggle sidebar visibility
 */
function toggleSidebar() {
  const sidebar = document.getElementById("notesSidebar");
  sidebar.classList.toggle("collapsed");
}

/**
 * Toggle dark mode
 */
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  darkMode = document.body.classList.contains("dark-mode");

  // Update theme icon
  const themeIcon = document.querySelector(".theme-toggle i");
  if (darkMode) {
    themeIcon.className = "fas fa-moon";
  } else {
    themeIcon.className = "fas fa-sun";
  }

  saveNotes();
}

/**
 * Toggle fullscreen mode
 */
function toggleFullscreen() {
  const editor = document.querySelector(".editor");
  const sidebar = document.getElementById("notesSidebar");
  const header = document.querySelector(".app-header");
  const fullscreenBtn = document.querySelector(
    '.toolbar-btn[title*="Fullscreen"] i',
  );

  if (!isFullscreen) {
    editor.classList.add("fullscreen");
    sidebar.style.display = "none";
    header.style.display = "none";
    if (fullscreenBtn) fullscreenBtn.className = "fas fa-compress";
    isFullscreen = true;
  } else {
    editor.classList.remove("fullscreen");
    sidebar.style.display = "flex";
    header.style.display = "flex";
    if (fullscreenBtn) fullscreenBtn.className = "fas fa-expand";
    isFullscreen = false;
  }
}

/**
 * Search/filter notes
 */
function searchNotes() {
  const searchTerm = document.getElementById("searchNotes").value.toLowerCase();
  const noteItems = document.querySelectorAll("#noteList li");

  noteItems.forEach((item) => {
    const title =
      item.querySelector(".note-title")?.textContent.toLowerCase() || "";
    const preview =
      item.querySelector(".note-preview")?.textContent.toLowerCase() || "";

    if (title.includes(searchTerm) || preview.includes(searchTerm)) {
      item.style.display = "";
    } else {
      item.style.display = "none";
    }
  });
}

/**
 * Update word and character count
 */
function updateWordCount() {
  const content = document.getElementById("editorBox").innerText;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;

  document.getElementById("wordCount").textContent =
    `${words} word${words !== 1 ? "s" : ""}`;
  document.getElementById("charCount").textContent =
    `${chars} character${chars !== 1 ? "s" : ""}`;
}

/**
 * Download current note as text file
 */
function downloadText() {
  if (currentNoteIndex === null) return;

  const textContent = document.getElementById("editorBox").innerText;
  const currentNoteTitle =
    document.getElementById("currentNoteTitle").value || "note";

  const blob = new Blob([textContent], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${currentNoteTitle}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Clear editor content from current note
 */
function clearEditorContent() {
  if (
    confirm(
      "Are you sure you want to clear the content of this note? This action cannot be undone.",
    )
  ) {
    document.getElementById("editorBox").innerHTML = "";
    saveCurrentNote();
    updateWordCount();
  }
}

// ===================================
// MODAL FUNCTIONS
// ===================================

/**
 * Open About modal
 */
function openAboutModal() {
  const modal = document.getElementById("aboutModal");
  modal.classList.add("show");

  // Close on outside click
  modal.onclick = function (e) {
    if (e.target === modal) {
      closeAboutModal();
    }
  };
}

/**
 * Close About modal
 */
function closeAboutModal() {
  const modal = document.getElementById("aboutModal");
  modal.classList.remove("show");
}

/**
 * Open Help modal
 */
function openHelpModal() {
  const modal = document.getElementById("helpModal");
  modal.classList.add("show");

  // Close on outside click
  modal.onclick = function (e) {
    if (e.target === modal) {
      closeHelpModal();
    }
  };
}

/**
 * Close Help modal
 */
function closeHelpModal() {
  const modal = document.getElementById("helpModal");
  modal.classList.remove("show");
}

// ===================================
// INITIALIZATION
// ===================================

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
