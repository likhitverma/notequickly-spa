    /**
 * NoteQuickly SPA - JavaScript
 * A modern note-taking application with local storage
 * Developer: Likhit Verma
 */
 
// ===================================
// STATE MANAGEMENT
// ===================================
 
let notesApplicationData = JSON.parse(
  localStorage.getItem("notesApplicationData")
) || { notes: [], isDarkMode: true }; // Dark mode default
 
let notes = notesApplicationData.notes;
let currentNoteIndex = null;
let darkMode = notesApplicationData.isDarkMode;
let isFullscreen = false;
 
// ===================================
// INITIALIZATION
// ===================================
 
/**
 * Initialize application on page load
 */
function init() {
  // Set dark mode if enabled
  if (darkMode) {
    document.body.classList.add("dark-mode");
  }
 
  // Update theme icon
  const themeIcon = document.querySelector('.theme-toggle i');
  if (themeIcon) {
    themeIcon.className = darkMode ? 'fas fa-moon' : 'fas fa-sun';
  }
 
  // Create first note if none exist
  if (notes.length === 0) {
    createNote();
  } else {
    openNote(0);
  }
 
  renderNotes();
  setupKeyboardShortcuts();
  updateWordCount();
}
 
/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', function(e) {
    // F1 - Help
    if (e.key === 'F1') {
      e.preventDefault();
      openHelpModal();
    }
   
    // Ctrl+K - Insert Link
    if (e.ctrlKey && e.key === 'k') {
      e.preventDefault();
      insertLink();
    }
   
    // F11 - Fullscreen
    if (e.key === 'F11') {
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
 
// ===================================
// NOTE MANAGEMENT
// ===================================
 
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
   
    // Format timestamp
    const timestamp = note.modified
      ? formatTimestamp(note.modified)
      : formatTimestamp(note.created || Date.now());
   
    li.innerHTML = `
      <span class="note-title">${note.title || `Note ${index + 1}`}</span>
      <span class="note-timestamp"><i class="fas fa-clock"></i> ${timestamp}</span>
      <span class="delete-icon" onclick="confirmDeleteNote(event, ${index})"><i class="fas fa-trash-alt"></i></span>
    `;
   
    li.onclick = (e) => {
      if (!e.target.classList.contains('delete-icon') &&
          !e.target.classList.contains('fa-trash-alt') &&
          !e.target.closest('.delete-icon')) {
        openNote(index);
      }
    };
   
    if (index === currentNoteIndex) {
      li.classList.add("active");
    }
   
    noteList.appendChild(li);
  });
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
 
  if (diffMins < 1) return 'Just now';
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
    content: "",
    created: Date.now(),
    modified: Date.now()
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
  document.getElementById("currentNoteTitle").value = note.title || `Note ${index + 1}`;
 
  renderNotes();
  updateWordCount();
}
 
/**
 * Save note title
 */
function saveNoteTitle() {
  if (currentNoteIndex !== null && currentNoteIndex < notes.length) {
    notes[currentNoteIndex].title = document.getElementById("currentNoteTitle").value;
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
    notes[currentNoteIndex].content = document.getElementById("editorBox").innerHTML;
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
 
  if (confirm(`Are you sure you want to delete "${notes[index].title || `Note ${index + 1}`}"?`)) {
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
  localStorage.setItem("notesApplicationData", JSON.stringify(notesApplicationData));
}
 
/**
 * Show save indicator
 */
function showSaveIndicator() {
  const indicator = document.getElementById("lastSaved");
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  indicator.textContent = `Saved at ${timeString}`;
  indicator.style.color = 'var(--accent-color)';
 
  setTimeout(() => {
    indicator.style.color = 'var(--text-secondary)';
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
      document.execCommand('createLink', false, url);
    } else {
      document.execCommand('insertHTML', false, `<a href="${url}">${linkText}</a>`);
    }
   
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
  const themeIcon = document.querySelector('.theme-toggle i');
  if (darkMode) {
    themeIcon.className = 'fas fa-moon';
  } else {
    themeIcon.className = 'fas fa-sun';
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
  const fullscreenBtn = document.querySelector('.toolbar-btn[title*="Fullscreen"] i');
 
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
    const title = item.querySelector(".note-title")?.textContent.toLowerCase() || "";
    const preview = item.querySelector(".note-preview")?.textContent.toLowerCase() || "";
   
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
 
  document.getElementById("wordCount").textContent = `${words} word${words !== 1 ? 's' : ''}`;
  document.getElementById("charCount").textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
}
 
/**
 * Download current note as text file
 */
function downloadText() {
  if (currentNoteIndex === null) return;
 
  const textContent = document.getElementById('editorBox').innerText;
  const currentNoteTitle = document.getElementById("currentNoteTitle").value || "note";
 
  const blob = new Blob([textContent], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${currentNoteTitle}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
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
  modal.onclick = function(e) {
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
  modal.onclick = function(e) {
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
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
