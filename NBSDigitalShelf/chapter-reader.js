(function() {
  const params = new URLSearchParams(window.location.search);
  const bookId = params.get("book");
  const chapterId = params.get("chapter");

  const bookTitleEl = document.querySelector("[data-book-title]");
  const chapterTitleEl = document.querySelector("[data-chapter-title]");
  const chapterTextEl = document.querySelector("[data-chapter-text]");
  const prevChapterBtn = document.querySelector("[data-prev-chapter]");
  const nextChapterBtn = document.querySelector("[data-next-chapter]");
  const feedback = document.querySelector("[data-reader-feedback]");

  async function loadChapter() {
    if (!bookId || !chapterId) {
      if (feedback) feedback.textContent = "Invalid book or chapter ID.";
      return;
    }

    const book = await window.nbsShelfData?.getBookById(bookId);
    if (!book) {
      if (feedback) feedback.textContent = "Book not found.";
      return;
    }

    const chapterIndex = (book.chapters || []).findIndex((c) => c.id === chapterId);
    if (chapterIndex === -1) {
      if (feedback) feedback.textContent = "Chapter not found.";
      return;
    }

    const chapter = book.chapters[chapterIndex];

    // Check access
    const access = await window.nbsShelfData?.getChapterAccess(book.id, chapter.id);
    if (!access?.canRead) {
      if (feedback) feedback.textContent = "You don't have access to this chapter. Please purchase it to read.";
      return;
    }

    // Render chapter
    if (bookTitleEl) bookTitleEl.textContent = `${book.genre}`;
    if (chapterTitleEl) chapterTitleEl.textContent = `Chapter ${chapterIndex + 1}: ${chapter.title}`;
    if (chapterTextEl) {
      chapterTextEl.textContent = chapter.text;
    }

    // Set up chapter navigation
    prevChapterBtn.hidden = false;
    if (chapterIndex > 0) {
      const prevChapter = book.chapters[chapterIndex - 1];
      prevChapterBtn.addEventListener("click", () => {
        window.location.href = `chapter-reader.html?book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(prevChapter.id)}`;
      });
    } else {
      prevChapterBtn.addEventListener("click", () => {
        window.history.back();
      });
    }

    if (chapterIndex < book.chapters.length - 1) {
      nextChapterBtn.hidden = false;
      const nextChapter = book.chapters[chapterIndex + 1];
      nextChapterBtn.addEventListener("click", () => {
        window.location.href = `chapter-reader.html?book=${encodeURIComponent(book.id)}&chapter=${encodeURIComponent(nextChapter.id)}`;
      });
    } else {
      nextChapterBtn.hidden = true;
    }
  }

  loadChapter().catch((err) => {
    console.error("Failed to load chapter:", err);
    if (feedback) feedback.textContent = "Failed to load chapter. Please try again.";
  });
})();
