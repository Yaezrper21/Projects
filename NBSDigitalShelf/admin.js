import {
  getAdminDashboardData,
  saveBook,
  saveAnnouncement,
  deleteAnnouncement,
  deleteBook,
  signOut
} from "./supabase-data.js";

function getGenreLabel(rawGenre) {
  const str = String(rawGenre || "").trim();
  if (!str) return "Uncategorized";
  return str
    .split(",")
    .map((g) => g.trim())
    .filter((g) => g.length > 0)
    .join(", ");
}

async function initAdminPage() {
  const feedback = document.querySelector("[data-admin-feedback]");
  const sessionBanner = document.querySelector("[data-session-banner]");
  const statsNodes = {
    users: document.querySelector('[data-stat="users"]'),
    admins: document.querySelector('[data-stat="admins"]'),
    superAdmins: document.querySelector('[data-stat="super-admins"]'),
    orders: document.querySelector('[data-stat="orders"]'),
    books: document.querySelector('[data-stat="books"]'),
    announcements: document.querySelector('[data-stat="announcements"]'),
    views: document.querySelector('[data-stat="views"]')
  };
  const superAdminOnlyCards = document.querySelectorAll("[data-super-admin-only]");
  const bookForm = document.querySelector('[data-admin-form="book"]');
  const announcementForm = document.querySelector('[data-admin-form="announcement"]');
  const booksContainer = document.querySelector("[data-admin-books]");
  const announcementsContainer = document.querySelector("[data-admin-announcements]");
  const profileContainer = document.querySelector("[data-admin-profile]");
  const logoutButton = document.querySelector("[data-logout]");

  // Track which announcement is being edited (null = create mode)
  let currentAnnouncementId = null;

  function setFeedback(message, state = "info") {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.state = state;
  }

  // Create Book form handler
  if (bookForm) {
    bookForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(bookForm);
      const title = (formData.get("title") || "").toString().trim();
      const genre = (formData.get("genre") || "").toString().trim();
      const description = (formData.get("description") || "").toString().trim();
      const imageFile = formData.get("image");

      if (!title || !genre || !description) {
        setFeedback("Book title, genre, and description are required.", "error");
        return;
      }

      try {
        setFeedback("Creating book...", "info");
        await saveBook({
          title,
          genre, // may contain comma-separated genres, e.g. "Action, Fantasy"
          description,
          imageFile: imageFile instanceof File ? imageFile : null
        });
        setFeedback("Book created.", "success");
        bookForm.reset();

        // Refresh books list
        const refreshed = await getAdminDashboardData();
        const refreshedBooks = refreshed.books || [];

        if (!booksContainer) return;

        if (!refreshedBooks.length) {
          booksContainer.innerHTML =
            `<div class="empty-shelf">No books yet. Use the form above to create the first one.</div>`;
        } else {
          booksContainer.innerHTML = refreshedBooks
            .map(
              (book) => `
              <article class="management-row">
                <div>
                  <p class="management-title">${escapeHtml(book.title)}</p>
                  <p class="management-meta">
                    ${escapeHtml(getGenreLabel(book.genre))} · ${(book.chapters || []).length} chapters
                  </p>
                </div>
                <div class="management-actions">
                  <button
                    class="ghost-button compact-ghost"
                    type="button"
                    data-admin-edit-book="${book.id}"
                  >
                    Edit
                  </button>
                  <button
                    class="ghost-button compact-ghost"
                    type="button"
                    data-admin-delete-book="${book.id}"
                  >
                    Delete
                  </button>
                </div>
              </article>
            `
            )
            .join("");
        }
      } catch (error) {
        console.error(error);
        setFeedback(error.message || "Unable to create the book.", "error");
      }
    });
  }

  try {
    // Load dashboard data (will throw if not admin)
    const data = await getAdminDashboardData();

    const { currentUser, stats, books, announcements, accounts } = data;

    if (sessionBanner && currentUser) {
      sessionBanner.textContent = `Signed in as ${currentUser.username} (${currentUser.role})`;
    }

    // Stats
    if (statsNodes.users) statsNodes.users.textContent = String(stats.users ?? 0);
    if (statsNodes.admins) statsNodes.admins.textContent = String(stats.admins ?? 0);
    if (statsNodes.superAdmins) statsNodes.superAdmins.textContent = String(stats.superAdmins ?? 0);
    if (statsNodes.orders) statsNodes.orders.textContent = String(stats.orders ?? 0);
    if (statsNodes.books) statsNodes.books.textContent = String(stats.books ?? 0);
    if (statsNodes.announcements) statsNodes.announcements.textContent = String(stats.announcements ?? 0);
    if (statsNodes.views) statsNodes.views.textContent = String(stats.views ?? 0);

    // Super admin metrics visibility
    const isSuperAdmin = currentUser?.role === "super_admin";
    superAdminOnlyCards.forEach((card) => {
      card.hidden = !isSuperAdmin;
    });

    // Profile card
    if (profileContainer && currentUser) {
      profileContainer.innerHTML = `
        <div class="profile-fields">
          <p>Username: <span>${escapeHtml(currentUser.username || "")}</span></p>
          <p>Email: <span>${escapeHtml(currentUser.email || "")}</span></p>
          <p>Role: <span>${escapeHtml(currentUser.role || "")}</span></p>
        </div>
      `;
    }

    // Books list
    if (booksContainer) {
      if (!books.length) {
        booksContainer.innerHTML =
          `<div class="empty-shelf">No books yet. Use the form above to create the first one.</div>`;
      } else {
        booksContainer.innerHTML = books
          .map(
            (book) => `
          <article class="management-row">
            <div>
              <p class="management-title">${escapeHtml(book.title)}</p>
              <p class="management-meta">
                ${escapeHtml(getGenreLabel(book.genre))} · ${(book.chapters || []).length} chapters
              </p>
            </div>
            <div class="management-actions">
              <button
                class="ghost-button compact-ghost"
                type="button"
                data-admin-edit-book="${book.id}"
              >
                Edit
              </button>
              <button
                class="ghost-button compact-ghost"
                type="button"
                data-admin-delete-book="${book.id}"
              >
                Delete
              </button>
            </div>
          </article>
        `
          )
          .join("");
      }

      // Handle Edit / Delete clicks on books
      booksContainer.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const editId = target.dataset.adminEditBook;
        const deleteId = target.dataset.adminDeleteBook;

        // Edit: go to edit-book.html?id=<id>
        if (editId) {
          window.location.href = `edit-book.html?id=${editId}`;
          return;
        }

        // Delete: delete the book and refresh
        if (deleteId) {
          if (!confirm("Are you sure you want to delete this book?")) return;

          try {
            setFeedback("Deleting book...", "info");
            await deleteBook(deleteId);
            setFeedback("Book deleted.", "success");

            const refreshed = await getAdminDashboardData();
            const refreshedBooks = refreshed.books || [];
            if (!refreshedBooks.length) {
              booksContainer.innerHTML =
                `<div class="empty-shelf">No books yet. Use the form above to create the first one.</div>`;
            } else {
              booksContainer.innerHTML = refreshedBooks
                .map(
                  (book) => `
                <article class="management-row">
                  <div>
                    <p class="management-title">${escapeHtml(book.title)}</p>
                    <p class="management-meta">
                      ${escapeHtml(getGenreLabel(book.genre))} · ${(book.chapters || []).length} chapters
                    </p>
                  </div>
                  <div class="management-actions">
                    <button
                      class="ghost-button compact-ghost"
                      type="button"
                      data-admin-edit-book="${book.id}"
                    >
                      Edit
                    </button>
                    <button
                      class="ghost-button compact-ghost"
                      type="button"
                      data-admin-delete-book="${book.id}"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              `
                )
                .join("");
            }
          } catch (error) {
            console.error(error);
            setFeedback(error.message || "Unable to delete the book.", "error");
          }
        }
      });
    }

    // Announcement form (create or update)
    if (announcementForm) {
      announcementForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(announcementForm);
        const title = formData.get("title")?.toString().trim() || "";

        if (!title) {
          setFeedback("Announcement text is required.", "error");
          return;
        }

        try {
          if (currentAnnouncementId) {
            // Update existing announcement
            setFeedback("Updating announcement...", "info");
            const { error } = await window.supabase
              .from("announcements")
              .update({ title })
              .eq("id", currentAnnouncementId);

            if (error) throw error;
            setFeedback("Announcement updated.", "success");
          } else {
            // Create new announcement
            setFeedback("Saving announcement...", "info");
            await saveAnnouncement(title);
            setFeedback("Announcement created.", "success");
          }

          announcementForm.reset();
          currentAnnouncementId = null;

          const refreshed = await getAdminDashboardData();
          const refreshedAnnouncements = refreshed.announcements || [];
          if (announcementsContainer) {
            if (!refreshedAnnouncements.length) {
              announcementsContainer.innerHTML =
                `<div class="empty-shelf">No announcements yet.</div>`;
            } else {
              announcementsContainer.innerHTML = refreshedAnnouncements
                .map(
                  (item) => `
                <article class="management-row">
                  <div>
                    <p class="management-title">${escapeHtml(item.title)}</p>
                  </div>
                  <div class="management-actions">
                    <button
                      class="ghost-button compact-ghost"
                      type="button"
                      data-admin-edit-announcement="${item.id}"
                    >
                      Edit
                    </button>
                    <button
                      class="ghost-button compact-ghost"
                      type="button"
                      data-admin-delete-announcement="${item.id}"
                    >
                      Delete
                    </button>
                  </div>
                </article>
              `
                )
                .join("");
            }
          }
        } catch (error) {
          console.error(error);
          setFeedback(error.message || "Unable to save the announcement.", "error");
        }
      });
    }

    // Edit + Delete announcement buttons (fixed: coerce id to number)
    if (announcementsContainer) {
      announcementsContainer.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const deleteIdRaw = target.dataset.adminDeleteAnnouncement;
        const editIdRaw = target.dataset.adminEditAnnouncement;

        // Edit: load into form
        if (editIdRaw && announcementForm) {
          try {
            const data = await getAdminDashboardData();
            const announcement =
              (data.announcements || []).find((a) => String(a.id) === String(editIdRaw));

            if (!announcement) {
              setFeedback("Unable to find that announcement.", "error");
              return;
            }

            const titleInput = announcementForm.querySelector('input[name="title"]');
            if (titleInput) {
              titleInput.value = announcement.title || "";
            }
            currentAnnouncementId = announcement.id;
            setFeedback("Editing announcement. Save to update.", "info");
          } catch (error) {
            console.error(error);
            setFeedback(error.message || "Unable to load the announcement.", "error");
          }
          return;
        }

        // Delete announcement
        if (!deleteIdRaw) return;

        const deleteId = Number(deleteIdRaw);
        if (!Number.isFinite(deleteId)) {
          setFeedback("Invalid announcement id.", "error");
          return;
        }

        try {
          setFeedback("Removing announcement...", "info");
          await deleteAnnouncement(deleteId);
          setFeedback("Announcement removed.", "success");

          const refreshed = await getAdminDashboardData();
          const refreshedAnnouncements = refreshed.announcements || [];
          if (!refreshedAnnouncements.length) {
            announcementsContainer.innerHTML =
              `<div class="empty-shelf">No announcements yet.</div>`;
          } else {
            announcementsContainer.innerHTML = refreshedAnnouncements
              .map(
                (item) => `
              <article class="management-row">
                <div>
                  <p class="management-title">${escapeHtml(item.title)}</p>
                </div>
                <div class="management-actions">
                  <button
                    class="ghost-button compact-ghost"
                    type="button"
                    data-admin-edit-announcement="${item.id}"
                  >
                    Edit
                  </button>
                  <button
                    class="ghost-button compact-ghost"
                    type="button"
                    data-admin-delete-announcement="${item.id}"
                  >
                    Delete
                  </button>
                </div>
              </article>
            `
              )
              .join("");
          }
        } catch (error) {
          console.error(error);
          setFeedback(error.message || "Unable to remove the announcement.", "error");
        }
      });
    }

    // Logout button on admin page
    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        try {
          await signOut();
          window.location.href = "index.html";
        } catch (error) {
          console.error(error);
          setFeedback("Unable to log out.", "error");
        }
      });
    }

    setFeedback("Admin dashboard loaded.", "success");
  } catch (error) {
    console.error(error);
    const message = error.message || "Admin access is required.";
    if (feedback) {
      feedback.textContent = message;
      feedback.dataset.state = "error";
    }
    window.location.href = "login.html";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

document.addEventListener("DOMContentLoaded", () => {
  void initAdminPage();
});
