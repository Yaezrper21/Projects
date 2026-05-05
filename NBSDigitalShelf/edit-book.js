import {
  getAdminBookById,
  saveBook,
  saveChapter,
  deleteChapter,
} from "./supabase-data.js";

function getBookIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || "";
}

async function initEditBookPage() {
  const bookId = getBookIdFromUrl();
  if (!bookId) {
    window.location.href = "admin.html";
    return;
  }

  const headingEl = document.querySelector("[data-edit-book-heading]");
  const bookEditorTitle = document.querySelector("[data-book-editor-title]");
  const chapterBookTitle = document.querySelector("[data-chapter-book-title]");
  const bookForm = document.querySelector('[data-admin-form="book"]');
  const chapterForm = document.querySelector('[data-admin-form="chapter"]');
  const chaptersContainer = document.querySelector("[data-admin-chapters]");
  const feedback = document.querySelector("[data-admin-feedback]");

  function setFeedback(message, state = "info") {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.state = state;
  }

  try {
    setFeedback("Loading book...", "info");
    const book = await getAdminBookById(bookId);
    if (!book) {
      setFeedback("Book not found.", "error");
      return;
    }

    // Headings
    if (headingEl) headingEl.textContent = book.title;
    if (bookEditorTitle) bookEditorTitle.textContent = `Edit "${book.title}"`;
    if (chapterBookTitle) chapterBookTitle.textContent = `Chapters for "${book.title}"`;

    // Prefill book form (edit book)
    if (bookForm) {
      const idInput = bookForm.querySelector('input[name="id"]');
      const titleInput = bookForm.querySelector('input[name="title"]');
      const genreInput = bookForm.querySelector('input[name="genre"]');
      const descInput = bookForm.querySelector('textarea[name="description"]');

      if (idInput) idInput.value = book.id;
      if (titleInput) titleInput.value = book.title || "";
      if (genreInput) genreInput.value = book.genre || "";
      if (descInput) descInput.value = book.description || "";

      // Handle Save Book submit (reuse saveBook for update)
      bookForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(bookForm);

        const payload = {
          id: formData.get("id")?.toString() || "",
          title: formData.get("title")?.toString().trim() || "",
          genre: formData.get("genre")?.toString().trim() || "",
          description: formData.get("description")?.toString().trim() || "",
          imageFile: formData.get("image") instanceof File ? formData.get("image") : null,
        };

        if (!payload.id) {
          setFeedback("Missing book ID.", "error");
          return;
        }
        if (!payload.title || !payload.genre || !payload.description) {
          setFeedback("Book title, genre, and description are required.", "error");
          return;
        }

        try {
          setFeedback("Saving book...", "info");
          await saveBook(payload);
          setFeedback("Book updated.", "success");
        } catch (error) {
          console.error(error);
          setFeedback(error.message || "Unable to save the book.", "error");
        }
      });
    }

    // Prefill chapter form bookId
    if (chapterForm) {
      const bookIdInput = chapterForm.querySelector('input[name="bookId"]');
      if (bookIdInput) bookIdInput.value = book.id;

      // Handle Save Chapter submit (add or edit)
      chapterForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(chapterForm);

        const payload = {
          bookId: formData.get("bookId")?.toString() || "",
          chapterId: formData.get("chapterId")?.toString() || "",
          title: formData.get("title")?.toString().trim() || "",
          text: formData.get("text")?.toString() || "",
          accessType: formData.get("accessType")?.toString() || "free",
        };

        if (!payload.bookId) {
          setFeedback("Missing book ID.", "error");
          return;
        }
        if (!payload.title || !payload.text) {
          setFeedback("Chapter title and text are required.", "error");
          return;
        }

        try {
          setFeedback("Saving chapter...", "info");
          await saveChapter(payload);
          setFeedback("Chapter saved.", "success");
          window.location.reload(); // reload to refresh chapter list with new text/order
        } catch (error) {
          console.error(error);
          setFeedback(error.message || "Unable to save the chapter.", "error");
        }
      });
    }

    // Render chapter list (with Edit/Delete)
    if (chaptersContainer) {
      if (!book.chapters?.length) {
        chaptersContainer.innerHTML = `<div class="empty-shelf">No chapters yet.</div>`;
      } else {
        chaptersContainer.innerHTML = book.chapters
          .map(
            (ch) => `
              <article class="management-row">
                <div>
                  <p class="management-title">${ch.chapterOrder}. ${ch.title}</p>
                  <p class="management-meta">${ch.isPaid ? "Paid" : "Free"}</p>
                </div>
                <div class="management-actions">
                  <button class="ghost-button compact-ghost" type="button" data-edit-chapter="${ch.id}">
                    Edit
                  </button>
                  <button class="ghost-button compact-ghost" type="button" data-delete-chapter="${ch.id}">
                    Delete
                  </button>
                </div>
              </article>
            `
          )
          .join("");
      }

      // Handle Edit/Delete clicks on chapters
      chaptersContainer.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const editId = target.dataset.editChapter;
        const deleteId = target.dataset.deleteChapter;

        // Edit chapter: fill the chapter form with existing data
        if (editId && chapterForm && book.chapters) {
          const ch = book.chapters.find((c) => c.id === editId);
          if (!ch) return;

          const chapterIdInput = chapterForm.querySelector('input[name="chapterId"]');
          const titleInput = chapterForm.querySelector('input[name="title"]');
          const textInput = chapterForm.querySelector('textarea[name="text"]');
          const accessSelect = chapterForm.querySelector('select[name="accessType"]');

          if (chapterIdInput) chapterIdInput.value = ch.id;
          if (titleInput) titleInput.value = ch.title || "";
          if (textInput) textInput.value = ch.text || "";
          if (accessSelect) accessSelect.value = ch.isPaid ? "paid" : "free";
        }

        // Delete chapter
        if (deleteId) {
          if (!confirm("Delete this chapter?")) return;

          try {
            setFeedback("Deleting chapter...", "info");
            await deleteChapter(book.id, deleteId);
            setFeedback("Chapter deleted.", "success");
            window.location.reload();
          } catch (error) {
            console.error(error);
            setFeedback(error.message || "Unable to delete chapter.", "error");
          }
        }
      });
    }

    setFeedback("Book loaded.", "success");
  } catch (error) {
    console.error(error);
    setFeedback(error.message || "Unable to load book.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.body.dataset.page === "edit-book") {
    void initEditBookPage();
  }
});
