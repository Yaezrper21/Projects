const libraryButtons = document.querySelectorAll("[data-library-tab]");
const libraryViews = document.querySelectorAll(".library-view");
let currentBooks = [];

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  // NEW: highlight current navigation item
  const navLinks = Array.from(document.querySelectorAll(".nav-link"));
  navLinks.forEach((link) => {
    const linkPage = link.dataset.page;
    if (linkPage === page) {
      link.classList.add("nav-active");
    } else {
      link.classList.remove("nav-active");
    }
  });

  if (page === "home" || page === "library" || page === "search" || page === "profile") {
    bindLibraryTabs();
    handleLibraryHash();
    void renderDynamicContent();
  }
});

function bindLibraryTabs() {
  libraryButtons.forEach((button) => {
    button.addEventListener("click", () => setLibraryTab(button.dataset.libraryTab));
  });
}

function setLibraryTab(tabId) {
  libraryViews.forEach((view) => view.classList.toggle("active", view.id === `library-${tabId}`));
  libraryButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.libraryTab === tabId);
  });
}

function handleLibraryHash() {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return;
  const validTabs = Array.from(libraryButtons).map((button) => button.dataset.libraryTab);
  if (validTabs.includes(hash)) {
    setLibraryTab(hash);
  }
}

async function renderDynamicContent() {
  const books = await loadBooks();
  currentBooks = books;
  const announcements = await loadAnnouncements();
  renderAnnouncements(announcements);
  renderShelves(books);
  renderSearchResults(books);
  ensureBookModal();
}

async function loadBooks() {
  try {
    return window.nbsShelfData ? await window.nbsShelfData.getBooks() : [];
  } catch {
    return [];
  }
}

async function loadAnnouncements() {
  try {
    return window.nbsShelfData ? await window.nbsShelfData.getAnnouncements() : [];
  } catch {
    return [];
  }
}

function renderAnnouncements(items) {
  const container = document.querySelector("[data-announcement-list]");
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `<div class="list-line">No announcements yet.</div>`;
    return;
  }

  container.innerHTML = items
    .slice(-4)
    .reverse()
    .map((item) => `<div class="list-line">${escapeHtml(item.title)}</div>`)
    .join("");
}

function renderShelves(books) {
  const popular = [...books].sort((a, b) => Number(b.totalViews || 0) - Number(a.totalViews || 0));
  const trending = [...books].sort((a, b) => Number(b.todayViews || 0) - Number(a.todayViews || 0));
  const latest = [...books].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  fillShelf("home-popular", popular.slice(0, 5));
  fillShelf("home-trending", trending.slice(0, 5));
  fillShelf("home-latest", latest.slice(0, 10));

  renderGenreSections(books);
  fillShelf("library-popular-grid", popular);
  fillShelf("library-trending-grid", trending);
  fillShelf("library-latest-grid", latest);
}

function renderGenreSections(books) {
  const container = document.querySelector("[data-genre-sections]");
  if (!container) return;

  const grouped = new Map();
  books.forEach((book) => {
    const genre = book.genre || "Uncategorized";
    if (!grouped.has(genre)) grouped.set(genre, []);
    grouped.get(genre).push(book);
  });

  if (!grouped.size) {
    container.innerHTML = `<div class="empty-shelf">No books yet. Admins can start adding titles from the dashboard.</div>`;
    return;
  }

  const genres = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));
  const genreIds = genres.map((_, index) => `genre-${index}`);

  container.innerHTML = `
    <div class="genre-filter-row">
      <label class="field-label" for="genre-filter">Select genre</label>
      <select id="genre-filter" class="text-input" data-genre-filter>
        ${genres
          .map((genre, index) => `<option value="${index}">${escapeHtml(genre)}</option>`)
          .join("")}
      </select>
    </div>
    <div class="book-grid tall" id="library-genre-grid"></div>
  `;

  const filter = container.querySelector("[data-genre-filter]");
  const selectedGenreIndex = filter ? Number(filter.value) : 0;
  fillShelf("library-genre-grid", grouped.get(genres[selectedGenreIndex]) || []);

  if (filter) {
    filter.addEventListener("change", () => {
      const index = Number(filter.value);
      fillShelf("library-genre-grid", grouped.get(genres[index]) || []);
    });
  }
}

function fillShelf(id, books) {
  const container = document.getElementById(id);
  if (!container) return;
  container.innerHTML = "";

  if (!books.length) {
    container.innerHTML = `<div class="empty-shelf">No books yet. Admins can add titles from the dashboard.</div>`;
    return;
  }

  books.forEach((book) => container.appendChild(createBookCard(book)));
}

function createBookCard(book) {
  const card = document.createElement("article");
  card.className = "book-card interactive-card";

  const chapterCount = Array.isArray(book.chapters) ? book.chapters.length : 0;
  const buyableCount = (book.chapters || []).filter((chapter) => chapter.isPaid).length;
  const cover = book.imageDataUrl
    ? `<img class="book-cover-image" src="${book.imageDataUrl}" alt="${escapeHtml(book.title)} cover">`
    : `<div class="book-cover-fallback">${escapeHtml(buildInitials(book.title))}</div>`;

  card.innerHTML = `
    <div class="book-cover">${cover}</div>
    <div class="book-meta">
      <p class="book-title">${escapeHtml(book.title)}</p>
      <p class="book-subtitle">${escapeHtml(book.genre || "Uncategorized")}</p>
      <p class="book-description">${escapeHtml(book.description || "No description yet.")}</p>
      <div class="book-stats">
        <span>${chapterCount} chapters</span>
        <span>${buyableCount} locked</span>
      </div>
      <div class="book-stats">
        <span>${Number(book.totalViews || 0)} all-time views</span>
        <span>${Number(book.todayViews || 0)} today</span>
      </div>
      <button class="primary-button compact" type="button">Open Book</button>
    </div>
  `;

  card.querySelector("button")?.addEventListener("click", () => {
    void openBookModal(book.id);
  });

  return card;
}

function renderSearchResults(books) {
  const resultsContainer = document.querySelector("[data-search-results]");
  const searchInput = document.querySelector("[data-search-input]");
  const searchButton = document.querySelector("[data-search-button]");
  if (!resultsContainer || !searchInput || !searchButton) return;

  const paint = (query = "") => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? currentBooks.filter((book) =>
          [book.title, book.genre, book.description, ...(book.chapters || []).map((chapter) => chapter.title)]
            .join(" ")
            .toLowerCase()
            .includes(normalized)
        )
      : currentBooks;

    if (!filtered.length) {
      resultsContainer.innerHTML = `<div class="search-result"><p class="order-name">No books found.</p><p class="order-meta">Try another title, genre, or chapter.</p></div>`;
      return;
    }

    resultsContainer.innerHTML = filtered
      .map((book) => `
        <div class="search-result search-result-book">
          <div>
            <p class="order-name">${escapeHtml(book.title)}</p>
            <p class="order-meta">${escapeHtml(book.genre)} &middot; ${(book.chapters || []).length} chapters &middot; ${Number(book.todayViews || 0)} today views</p>
          </div>
          <button class="primary-button compact" type="button" data-open-book="${book.id}">Open</button>
        </div>
      `)
      .join("");

    resultsContainer.querySelectorAll("[data-open-book]").forEach((button) => {
      button.addEventListener("click", () => {
        void openBookModal(Number(button.dataset.openBook));
      });
    });
  };

  if (!searchButton.dataset.bound) {
    searchButton.dataset.bound = "true";
    searchButton.addEventListener("click", () => paint(searchInput.value));
  }

  if (!searchInput.dataset.bound) {
    searchInput.dataset.bound = "true";
    searchInput.addEventListener("input", () => paint(searchInput.value));
  }

  paint("");
}

function ensureBookModal() {
  if (document.getElementById("book-modal")) return;

  const modal = document.createElement("div");
  modal.id = "book-modal";
  modal.className = "modal-shell";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="modal-backdrop" data-close-modal></div>
    <div class="modal-panel">
      <button class="modal-close" type="button" data-close-modal>Close</button>
      <div data-modal-content></div>
    </div>
  `;

  modal.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => closeBookModal());
  });

  document.body.appendChild(modal);
}

function closeBookModal() {
  const modal = document.getElementById("book-modal");
  if (!modal) return;
  modal.hidden = true;
}

async function openBookModal(bookId, trackView = true, flashMessage = "", flashState = "info") {
  ensureBookModal();
  const modal = document.getElementById("book-modal");
  const content = modal?.querySelector("[data-modal-content]");
  if (!modal || !content) return;

  if (trackView) {
    await window.nbsShelfData?.incrementBookView(bookId);
  }
  const book = await window.nbsShelfData?.getBookById(bookId);
  const currentUser = await window.nbsShelfData?.getCurrentUser();
  if (!book) return;

  modal.hidden = false;
  content.innerHTML = `
    <section class="book-detail">
      <div class="book-detail-hero">
        <div class="book-detail-cover">
          ${book.imageDataUrl
            ? `<img class="book-cover-image" src="${book.imageDataUrl}" alt="${escapeHtml(book.title)} cover">`
            : `<div class="book-cover-fallback">${escapeHtml(buildInitials(book.title))}</div>`}
        </div>
        <div class="book-detail-copy">
          <p class="panel-title">${escapeHtml(book.genre)}</p>
          <h2>${escapeHtml(book.title)}</h2>
          <p class="feature-text">${escapeHtml(book.description)}</p>
          <div class="book-stats wide">
            <span>${Number(book.totalViews || 0)} overall views</span>
            <span>${Number(book.todayViews || 0)} views today</span>
            <span>${(book.chapters || []).length} total chapters</span>
          </div>
          <div class="book-actions-row">
            <button class="primary-button" type="button" data-book-buy-chapters>Buy Chapters</button>
            <button class="ghost-button" type="button" data-book-buy-book>Buy Book</button>
          </div>
          <p class="muted-copy align-left">${currentUser ? `Signed in as ${escapeHtml(currentUser.username)}.` : "Guest mode: paid chapters require an account and purchase."}</p>
        </div>
      </div>
      <div class="chapter-reader-list" data-modal-chapters></div>
      <p class="feedback-strip align-left" data-modal-feedback></p>
    </section>
  `;

  const chapterList = content.querySelector("[data-modal-chapters]");
  const feedback = content.querySelector("[data-modal-feedback]");
  const buyChaptersButton = content.querySelector("[data-book-buy-chapters]");
    const buyBookButton = content.querySelector("[data-book-buy-book]");

  // Buy Book: go to physical purchase page
  if (buyBookButton) {
    buyBookButton.addEventListener("click", () => {
      const url = `buy-book.html?book=${encodeURIComponent(book.id)}`;
      window.location.href = url;
    });
  }

  if (!(book.chapters || []).length) {
    chapterList.innerHTML = `<div class="empty-shelf">No chapters published yet for this book.</div>`;
  } else {
    for (const [index, chapter] of (book.chapters || []).entries()) {
      const access = await window.nbsShelfData?.getChapterAccess(book.id, chapter.id);
      const canRead = Boolean(access?.canRead);
      const requiresPurchase = Boolean(access?.requiresPurchase);
      const isGuest = Boolean(access?.isGuest);

      const article = document.createElement("article");
      article.className = "chapter-card";
      article.innerHTML = `
        <div class="chapter-card-top">
          <div>
            <p class="chapter-title">Chapter ${index + 1}: ${escapeHtml(chapter.title)}</p>
            <p class="chapter-meta">${chapter.isPaid ? "Buyable chapter" : "Free chapter"}</p>
          </div>
          <div class="chapter-actions">
            ${canRead ? `<button class="ghost-button inline" type="button" data-read-chapter="${chapter.id}">Read</button>` : ""}
            ${requiresPurchase ? `<button class="primary-button inline" type="button" data-buy-chapter="${chapter.id}">${isGuest ? "Login To Buy" : "Buy Chapter"}</button>` : ""}
          </div>
        </div>
      `;
      chapterList.appendChild(article);
    }
  }

  chapterList.querySelectorAll("[data-read-chapter]").forEach((button) => {
    button.addEventListener("click", () => {
      const chapterId = button.dataset.readChapter;
      if (!chapterId) return;
      window.location.href = `chapter-reader.html?book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(chapterId)}`;
    });
  });

  chapterList.querySelectorAll("[data-buy-chapter]").forEach((button) => {
    button.addEventListener("click", async () => {
      const result = await window.nbsShelfData?.purchaseChapter(book.id, String(button.dataset.buyChapter || ""));
      setModalFeedback(feedback, result?.message || "Unable to complete purchase.", result?.ok ? "success" : "error");
      if (result?.ok) {
        await rerenderAfterBookChange(book.id, result.message || "", "success");
      }
    });
  });

  await rerenderShelvesInBackground();
}

async function rerenderAfterBookChange(bookId, flashMessage = "", flashState = "info") {
  await rerenderShelvesInBackground();
  await openBookModal(bookId, false, flashMessage, flashState);
}

async function rerenderShelvesInBackground() {
  const books = await loadBooks();
  currentBooks = books;
  renderShelves(books);
  renderSearchResults(books);
}

function setModalFeedback(node, message, state) {
  if (!node) return;
  node.textContent = message;
  node.dataset.state = state;
}

function buildInitials(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "NB";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
