// admin.js
import {
  getAdminDashboardData,
  saveBook,
  saveAnnouncement,
  deleteAnnouncement,
  signOut
} from "./supabase-data.js";

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

  function setFeedback(message, state = "info") {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.state = state;
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

    // Books list
    if (booksContainer) {
      if (!books.length) {
        booksContainer.innerHTML = `<div class="empty-shelf">No books yet. Use the form above to create the first one.</div>`;
      } else {
        booksContainer.innerHTML = books
          .map(
            (book) => `
          <article class="management-row">
            <div>
              <p class="management-title">${escapeHtml(book.title)}</p>
              <p class="management-meta">${escapeHtml(book.genre)} · ${(book.chapters || []).length} chapters</p>
            </div>
            <button class="ghost-button compact-ghost" type="button" data-admin-edit-book="${book.id}">Edit</button>
          </article>
        `
          )
          .join("");
      }
    }

        // Handle Edit Book clicks: go to edit-book.html?id=<bookId>
    if (booksContainer) {
      booksContainer.addEventListener("click", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const bookId = target.dataset.adminEditBook;
        if (!bookId) return;

        window.location.href = `edit-book.html?id=${bookId}`;
      });
    }

    // Announcements list
    if (announcementsContainer) {
      if (!announcements.length) {
        announcementsContainer.innerHTML = `<div class="empty-shelf">No announcements yet.</div>`;
      } else {
        announcementsContainer.innerHTML = announcements
          .map(
            (item) => `
          <article class="management-row">
            <div>
              <p class="management-title">${escapeHtml(item.title)}</p>
            </div>
            <button class="ghost-button compact-ghost" type="button" data-admin-delete-announcement="${item.id}">Delete</button>
          </article>
        `
          )
          .join("");
      }
    }

    // Profile summary
    if (profileContainer && currentUser) {
      profileContainer.innerHTML = `
        <p>Username: <strong>${escapeHtml(currentUser.username)}</strong></p>
        <p>Email: <strong>${escapeHtml(currentUser.email)}</strong></p>
        <p>Role: <strong>${escapeHtml(currentUser.role)}</strong></p>
      `;
    }

    // Book form
    if (bookForm) {
      const imageInput = bookForm.querySelector('[data-image-input]');
      const imagePreview = bookForm.querySelector('[data-image-preview]');
      const imageLabel = bookForm.querySelector('[data-image-label]');

      if (imageInput && imagePreview && imageLabel) {
        imageInput.addEventListener("change", () => {
          const file = imageInput.files?.[0] || null;
          if (!file) {
            imagePreview.innerHTML = `<div class="image-picker-fallback">BK</div>`;
            imageLabel.textContent = "Select cover picture";
            return;
          }

          const reader = new FileReader();
          reader.onload = () => {
            imagePreview.innerHTML = `<img class="book-cover-image" src="${reader.result}" alt="Cover preview">`;
          };
          reader.readAsDataURL(file);
          imageLabel.textContent = file.name;
        });
      }

      bookForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(bookForm);

        const payload = {
          id: "", // create new book; for editing you can fill this later
          title: formData.get("title")?.toString().trim() || "",
          genre: formData.get("genre")?.toString().trim() || "",
          description: formData.get("description")?.toString().trim() || "",
          imageFile: formData.get("image") instanceof File ? formData.get("image") : null
        };

        if (!payload.title || !payload.genre || !payload.description) {
          setFeedback("Book title, genre, and description are required.", "error");
          return;
        }

        try {
          setFeedback("Saving book...", "info");
          await saveBook(payload);
          setFeedback("Book saved successfully.", "success");
          bookForm.reset();
          if (imagePreview) {
            imagePreview.innerHTML = `<div class="image-picker-fallback">BK</div>`;
          }
          if (imageLabel) {
            imageLabel.textContent = "Select cover picture";
          }

          // Reload dashboard data to refresh counts and list
          const refreshed = await getAdminDashboardData();
          const refreshedBooks = refreshed.books || [];
          if (booksContainer) {
            if (!refreshedBooks.length) {
              booksContainer.innerHTML = `<div class="empty-shelf">No books yet. Use the form above to create the first one.</div>`;
            } else {
              booksContainer.innerHTML = refreshedBooks
                .map(
                  (book) => `
                <article class="management-row">
                  <div>
                    <p class="management-title">${escapeHtml(book.title)}</p>
                    <p class="management-meta">${escapeHtml(book.genre)} · ${(book.chapters || []).length} chapters</p>
                  </div>
                  <button class="ghost-button compact-ghost" type="button" data-admin-edit-book="${book.id}">Edit</button>
                </article>
              `
                )
                .join("");
            }
          }
        } catch (error) {
          console.error(error);
          setFeedback(error.message || "Unable to save the book.", "error");
        }
      });
    }

    // Announcement form
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
          setFeedback("Saving announcement...", "info");
          await saveAnnouncement(title);
          setFeedback("Announcement created.", "success");
          announcementForm.reset();

          const refreshed = await getAdminDashboardData();
          const refreshedAnnouncements = refreshed.announcements || [];
          if (announcementsContainer) {
            if (!refreshedAnnouncements.length) {
              announcementsContainer.innerHTML = `<div class="empty-shelf">No announcements yet.</div>`;
            } else {
              announcementsContainer.innerHTML = refreshedAnnouncements
                .map(
                  (item) => `
                <article class="management-row">
                  <div>
                    <p class="management-title">${escapeHtml(item.title)}</p>
                  </div>
                  <button class="ghost-button compact-ghost" type="button" data-admin-delete-announcement="${item.id}">Delete</button>
                </article>
              `
                )
                .join("");
            }
          }
        } catch (error) {
          console.error(error);
          setFeedback(error.message || "Unable to create the announcement.", "error");
        }
      });
    }

    // Delete announcement buttons
    if (announcementsContainer) {
      announcementsContainer.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        const id = target.dataset.adminDeleteAnnouncement;
        if (!id) return;

        try {
          setFeedback("Removing announcement...", "info");
          await deleteAnnouncement(id);
          setFeedback("Announcement removed.", "success");

          const refreshed = await getAdminDashboardData();
          const refreshedAnnouncements = refreshed.announcements || [];
          if (!refreshedAnnouncements.length) {
            announcementsContainer.innerHTML = `<div class="empty-shelf">No announcements yet.</div>`;
          } else {
            announcementsContainer.innerHTML = refreshedAnnouncements
              .map(
                (item) => `
              <article class="management-row">
                <div>
                  <p class="management-title">${escapeHtml(item.title)}</p>
                </div>
                <button class="ghost-button compact-ghost" type="button" data-admin-delete-announcement="${item.id}">Delete</button>
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
