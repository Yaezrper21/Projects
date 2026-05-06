const libraryButtons = document.querySelectorAll("[data-library-tab]");
const libraryViews = document.querySelectorAll(".library-view");
let currentBooks = [];

// Hero carousel state
let heroCarouselIndex = 0;
let heroCarouselTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  // Highlight current navigation item
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

  // Drive hero carousel on home from popular list
  initHeroCarousel(popular);
}

// ----- genre helpers -----

function getGenresArray(rawGenre) {
  const str = String(rawGenre || "").trim();
  if (!str) return ["Uncategorized"];
  return str
    .split(",")
    .map((g) => g.trim())
    .filter((g) => g.length > 0);
}

function renderGenreChips(rawGenre) {
  const genres = getGenresArray(rawGenre);
  return `
    <div class="book-genres">
      ${genres.map((g) => `<span class="genre-chip">${escapeHtml(g)}</span>`).join("")}
    </div>
  `;
}

function getGenreLabel(rawGenre) {
  const genres = getGenresArray(rawGenre);
  return genres.join(", ");
}

// ----- hero carousel -----

function initHeroCarousel(books) {
  const shell = document.querySelector("[data-hero-carousel]");
  const coverEl = document.querySelector("[data-hero-cover]");
  const titleEl = document.querySelector("[data-hero-title]");
  const metaEl = document.querySelector("[data-hero-meta]");
  const openBtn = document.querySelector("[data-hero-open]");

  // Only run on pages that actually have the hero
  if (!shell || !books.length) return;

  const slides = books.slice(0, 5); // top 5 popular
  heroCarouselIndex = 0;

  const showSlide = (index) => {
    const book = slides[index];
    if (!book) return;

    // Cover image or fallback initials
    if (coverEl) {
      if (book.imageDataUrl) {
        coverEl.innerHTML = `
          <img src="${book.imageDataUrl}" alt="${escapeHtml(book.title)} cover">
        `;
      } else {
        coverEl.innerHTML = `
          <div class="book-cover-fallback">${escapeHtml(buildInitials(book.title))}</div>
        `;
      }
    }

    // Short title and compact meta (no long description)
    if (titleEl) {
      titleEl.textContent = book.title;
    }

    if (metaEl) {
      const genreLabel = getGenreLabel(book.genre);
      metaEl.textContent = `${genreLabel} • ${(book.chapters || []).length} chapters • ${Number(
        book.totalViews || 0
      )} views`;
    }

    if (openBtn) {
      openBtn.onclick = async () => {
        const profile = await window.nbsShelfData?.getCurrentUser();
        if (!profile) {
          const params = new URLSearchParams({ next: `book-${book.id}` });
          window.location.href = `signup.html?${params.toString()}`;
          return;
        }

        void openBookModal(book.id);
      };
    }
  };

  showSlide(heroCarouselIndex);

  if (heroCarouselTimer) clearInterval(heroCarouselTimer);
  heroCarouselTimer = setInterval(() => {
    heroCarouselIndex = (heroCarouselIndex + 1) % slides.length;
    showSlide(heroCarouselIndex);
  }, 5000);
}

// ----- genre sections grid -----

function renderGenreSections(books) {
  const container = document.querySelector("[data-genre-sections]");
  if (!container) return;

  const grouped = new Map();

  books.forEach((book) => {
    const genres = getGenresArray(book.genre);
    genres.forEach((g) => {
      if (!grouped.has(g)) grouped.set(g, []);
      grouped.get(g).push(book);
    });
  });

  if (!grouped.size) {
    container.innerHTML = `<div class="empty-shelf">No books yet. Admins can start adding titles from the dashboard.</div>`;
    return;
  }

  const genres = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b));

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

// ----- shelves / cards -----

// ----- shelves / cards -----

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

// Limit description length for cards
function truncateText(value, maxLength = 120) {
  const str = String(value || "");
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + "…";
}

function createBookCard(book) {
  const card = document.createElement("article");
  card.className = "book-card interactive-card";

  const chapterCount = Array.isArray(book.chapters) ? book.chapters.length : 0;
  const buyableCount = (book.chapters || []).filter((chapter) => chapter.isPaid).length;
  const cover = book.imageDataUrl
    ? `<img class="book-cover-image" src="${book.imageDataUrl}" alt="${escapeHtml(book.title)} cover">`
    : `<div class="book-cover-fallback">${escapeHtml(buildInitials(book.title))}</div>`;

  const genreChips = renderGenreChips(book.genre);

  card.innerHTML = `
    <div class="book-cover">${cover}</div>
    <div class="book-meta">
      <p class="book-title">${escapeHtml(book.title)}</p>
      ${genreChips}
      <p class="book-description">
        ${escapeHtml(truncateText(book.description || "No description yet.", 120))}
      </p>
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

  card.querySelector("button")?.addEventListener("click", async () => {
    const profile = await window.nbsShelfData?.getCurrentUser();
    if (!profile) {
      const params = new URLSearchParams({ next: `book-${book.id}` });
      window.location.href = `signup.html?${params.toString()}`;
      return;
    }

    void openBookModal(book.id);
  });

  return card;
}

// ----- search -----

function renderSearchResults(books) {
  const resultsContainer = document.querySelector("[data-search-results]");
  const searchInput = document.querySelector("[data-search-input]");
  const searchButton = document.querySelector("[data-search-button]");
  if (!resultsContainer || !searchInput || !searchButton) return;

  const paint = (query = "") => {
    const normalized = query.trim().toLowerCase();
    const filtered = normalized
      ? currentBooks.filter((book) =>
          [
            book.title,
            getGenreLabel(book.genre),
            book.description,
            ...(book.chapters || []).map((chapter) => chapter.title)
          ]
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
      .map((book) => {
        const genreLabel = getGenreLabel(book.genre);
        return `
        <div class="search-result search-result-book">
          <div>
            <p class="order-name">${escapeHtml(book.title)}</p>
            <p class="order-meta">${escapeHtml(genreLabel)} &middot; ${(book.chapters || []).length} chapters &middot; ${Number(
          book.todayViews || 0
        )} today views</p>
          </div>
          <button class="primary-button compact" type="button" data-open-book="${book.id}">Open</button>
        </div>
      `;
      })
      .join("");

    resultsContainer.querySelectorAll("[data-open-book]").forEach((button) => {
      button.addEventListener("click", async () => {
        const profile = await window.nbsShelfData?.getCurrentUser();
        const bookId = Number(button.dataset.openBook);
        if (!profile) {
          const params = new URLSearchParams({ next: `book-${bookId}` });
          window.location.href = `signup.html?${params.toString()}`;
          return;
        }

        void openBookModal(bookId);
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

// ----- modal -----
// (keep your existing ensureBookModal / openBookModal / etc.)

// ----- helpers -----

function setModalFeedback(node, message, state) {
  if (!node) return;
  node.textContent = message;
  node.dataset.state = state;
}

function buildInitials(value) {
  return (
    String(value || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "NB"
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
/* --- scroll-hide/scroll-show topbar behavior --- */

let lastScrollY = window.scrollY;
let scrollTimeoutId = null;

function updateTopbarVisibility() {
  const topbar = document.querySelector(".topbar");
  if (!topbar) return;

  const currentY = window.scrollY;
  const isScrollingDown = currentY > lastScrollY + 4;
  const isScrollingUp = currentY < lastScrollY - 4;

  if (currentY < 40) {
    // Always show near the top of the page
    topbar.classList.remove("topbar--hidden");
  } else if (isScrollingDown) {
    topbar.classList.add("topbar--hidden");
  } else if (isScrollingUp) {
    topbar.classList.remove("topbar--hidden");
  }

  lastScrollY = currentY;
}

window.addEventListener("scroll", () => {
  updateTopbarVisibility();

  // If user stops scrolling, show bar again after a moment
  if (scrollTimeoutId) clearTimeout(scrollTimeoutId);
  scrollTimeoutId = setTimeout(() => {
    const topbar = document.querySelector(".topbar");
    if (topbar) topbar.classList.remove("topbar--hidden");
  }, 1200);
});

// Show bar again on any tap/click
window.addEventListener("pointerdown", () => {
  const topbar = document.querySelector(".topbar");
  if (topbar) topbar.classList.remove("topbar--hidden");
});
