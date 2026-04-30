(function () {
  const DB_NAME = "nbs-digital-shelf-db";
  const DB_VERSION = 3;
  const SESSION_KEY = "nbs-current-user-id";
  const RESET_KEY = "catalog-reset-v3";
  const LOCAL_DB_KEY = "nbs-local-db";
  const THEME_KEY = "nbs-theme";

  const DEFAULT_ACCOUNTS = [
    {
      email: "admin123@nbsds.com",
      password: "12345678",
      role: "admin",
      username: "NBS Admin",
      contactNumber: "+63 917 100 0101",
      address: "National Book Store Admin Office",
      authType: "password"
    },
    {
      email: "sadmin123@nbsds.com",
      password: "12345678",
      role: "super_admin",
      username: "NBS Super Admin",
      contactNumber: "+63 917 100 0202",
      address: "National Book Store Executive Office",
      authType: "password"
    }
  ];

  const DEFAULT_ANNOUNCEMENTS = [
    { title: "Weekend pocketbook sale now live" },
    { title: "Fresh educational bundles added" },
    { title: "Members get early access this Friday" }
  ];

  let dbPromise;
  let storageMode = "indexeddb";

  window.nbsShelfData = {
    getBooks,
    getBookById,
    getAnnouncements: () => getAllRecords("announcements"),
    getCurrentUser,
    incrementBookView,
    getChapterAccess,
    purchaseChapter
  };

  document.addEventListener("DOMContentLoaded", () => {
    void bootApp();
  });

  async function bootApp() {
    applyTheme();
    await ensureDatabase();
    await seedDefaults();
    await resetCatalogOnce();

    const page = document.body.dataset.page || "";
    await trackMetric(`page:${page || "unknown"}`);
    const currentUser = await getCurrentUser();

    await handleProtectedPage(page, currentUser);
    renderNavigation(currentUser);
    renderSessionBanner(currentUser);
    bindLogoutButtons();
    bindSocialButtons();

    if (page === "login") bindLoginForm();
    if (page === "signup") bindSignupForm();
    if (page === "profile") renderProfile(currentUser);
    if (page === "topup") bindTopup(currentUser);
    if (page === "order") await renderOrders(currentUser);
    if (page === "admin") await renderAdminDashboard(currentUser);
    if (page === "super-admin") await renderSuperAdminDashboard(currentUser);
    if (page === "edit-book") await renderEditBookPage(currentUser);
  }

  function ensureDatabase() {
    if (dbPromise) return dbPromise;

    if (!("indexedDB" in window)) {
      storageMode = "local";
      dbPromise = Promise.resolve(null);
      return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        const accounts = db.objectStoreNames.contains("accounts")
          ? request.transaction.objectStore("accounts")
          : db.createObjectStore("accounts", { keyPath: "id", autoIncrement: true });
        if (!accounts.indexNames.contains("email")) accounts.createIndex("email", "email", { unique: true });
        if (!accounts.indexNames.contains("role")) accounts.createIndex("role", "role", { unique: false });

        const books = db.objectStoreNames.contains("books")
          ? request.transaction.objectStore("books")
          : db.createObjectStore("books", { keyPath: "id", autoIncrement: true });
        if (!books.indexNames.contains("title")) books.createIndex("title", "title", { unique: false });

        const announcements = db.objectStoreNames.contains("announcements")
          ? request.transaction.objectStore("announcements")
          : db.createObjectStore("announcements", { keyPath: "id", autoIncrement: true });
        if (!announcements.indexNames.contains("title")) announcements.createIndex("title", "title", { unique: false });

        const orders = db.objectStoreNames.contains("orders")
          ? request.transaction.objectStore("orders")
          : db.createObjectStore("orders", { keyPath: "id", autoIncrement: true });
        if (!orders.indexNames.contains("accountId")) orders.createIndex("accountId", "accountId", { unique: false });

        if (!db.objectStoreNames.contains("metrics")) {
          db.createObjectStore("metrics", { keyPath: "key" });
        }
      };

      request.onsuccess = () => {
        storageMode = "indexeddb";
        resolve(request.result);
      };
      request.onerror = () => {
        storageMode = "local";
        resolve(null);
      };
    });

    return dbPromise;
  }

  async function seedDefaults() {
    for (const account of DEFAULT_ACCOUNTS) {
      await ensureDefaultAccount(account);
    }

    const announcements = await getAllRecords("announcements");
    if (!announcements.length) {
      for (const announcement of DEFAULT_ANNOUNCEMENTS) {
        await addRecord("announcements", announcement);
      }
    }
  }

  async function ensureDefaultAccount(account) {
    const accounts = await getAllRecords("accounts");
    const matches = accounts.filter((item) => String(item.email || "").toLowerCase() === account.email.toLowerCase());
    const passwordHash = await hashPassword(account.password);
    const { password, ...accountData } = account;

    if (!matches.length) {
      await addRecord("accounts", {
        ...accountData,
        passwordHash,
        createdAt: new Date().toISOString()
      });
      return;
    }

    const [primary, ...duplicates] = matches.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    await putRecord("accounts", {
      ...primary,
      ...accountData,
      email: account.email,
      passwordHash,
      createdAt: primary.createdAt || new Date().toISOString()
    });

    for (const duplicate of duplicates) {
      await deleteRecord("accounts", duplicate.id);
    }
  }

  async function resetCatalogOnce() {
    const resetFlag = await getRecord("metrics", RESET_KEY);
    if (resetFlag) return;
    await clearStore("books");
    await clearStore("orders");
    await putRecord("metrics", { key: RESET_KEY, value: 1 });
  }

  async function handleProtectedPage(page, currentUser) {
    if (page === "profile" && !currentUser) {
      redirectToLogin("Please log in first to view your profile.");
      return;
    }

    if (page === "admin" || page === "edit-book") {
      if (!currentUser) {
        redirectToLogin("Please log in with an admin account.");
        return;
      }
      if (!["admin", "super_admin"].includes(currentUser.role)) {
        window.location.href = "index.html";
      }
    }

    if (page === "super-admin") {
      if (!currentUser) {
        redirectToLogin("Please log in with a super admin account.");
        return;
      }
      if (currentUser.role !== "super_admin") {
        window.location.href = currentUser.role === "admin" ? "admin.html" : "index.html";
      }
    }
  }

  function redirectToLogin(message) {
    const url = new URL("login.html", window.location.href);
    url.searchParams.set("message", message);
    url.searchParams.set("redirect", document.body.dataset.page || "profile");
    window.location.href = url.toString();
  }

  function bindLoginForm() {
    const form = document.querySelector("[data-auth-form='login']");
    const feedback = document.querySelector("[data-auth-feedback]");
    if (!form) return;

    const params = new URLSearchParams(window.location.search);
    const message = params.get("message");
    if (message) setFeedback(feedback, message, "info");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");

      const account = await getAccountByEmail(email);
      if (!account) {
        setFeedback(feedback, "No account found for that email.", "error");
        return;
      }

      if (account.authType !== "password") {
        setFeedback(feedback, `This account uses ${formatAuthType(account.authType)} sign-in.`, "error");
        return;
      }

      if (account.passwordHash !== await hashPassword(password)) {
        setFeedback(feedback, "Incorrect password. Please try again.", "error");
        return;
      }

      await signInAccount(account, feedback, `Welcome back, ${account.username}.`);
    });
  }

  function bindSignupForm() {
    const form = document.querySelector("[data-auth-form='signup']");
    const feedback = document.querySelector("[data-auth-feedback]");
    if (!form) return;

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const username = String(formData.get("username") || "").trim();
      const email = String(formData.get("email") || "").trim().toLowerCase();
      const password = String(formData.get("password") || "");
      const confirmPassword = String(formData.get("confirmPassword") || "");
      const contactNumber = String(formData.get("contactNumber") || "").trim();
      const address = String(formData.get("address") || "").trim();

      if (!username || !email || !password || !confirmPassword) {
        setFeedback(feedback, "Please complete the required sign-up fields.", "error");
        return;
      }

      if (password.length < 8) {
        setFeedback(feedback, "Password must be at least 8 characters long.", "error");
        return;
      }

      if (password !== confirmPassword) {
        setFeedback(feedback, "Passwords do not match.", "error");
        return;
      }

      if (await getAccountByEmail(email)) {
        setFeedback(feedback, "That email is already registered.", "error");
        return;
      }

      const id = await addRecord("accounts", {
        username,
        email,
        passwordHash: await hashPassword(password),
        role: "user",
        authType: "password",
        contactNumber,
        address,
        createdAt: new Date().toISOString()
      });

      await signInAccount(await getRecord("accounts", id), feedback, "Account created. You are now logged in.");
    });
  }

  function renderNavigation(currentUser) {
    const nav = document.querySelector(".main-nav");
    if (!nav) return;

    const profileLink = nav.querySelector("a[href='profile.html']");
    const loginLink = nav.querySelector("a[href='login.html']");
    const signupLink = nav.querySelector("a[href='signup.html']");

    nav.querySelectorAll("[data-injected-nav='true']").forEach((node) => node.remove());
    insertThemeButton(nav);

    if (currentUser) {
      if (loginLink) loginLink.style.display = "none";
      if (signupLink) signupLink.style.display = "none";
      if (profileLink) profileLink.textContent = "Profile";

      if (currentUser.role === "admin") {
        insertNavLink(nav, "Admin Dashboard", "admin.html");
      }

      if (currentUser.role === "super_admin") {
        insertNavLink(nav, "Admin Dashboard", "admin.html");
        insertNavLink(nav, "Super Admin Dashboard", "super-admin.html");
      }
      return;
    }

    if (loginLink) loginLink.style.display = "";
    if (signupLink) signupLink.style.display = "";
    if (profileLink) {
      profileLink.addEventListener("click", interceptProfileGuestAccess, { once: true });
    }
  }

  function insertNavLink(nav, label, href) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    link.dataset.injectedNav = "true";
    link.className = "nav-link";
    if (window.location.pathname.endsWith(href)) link.classList.add("active");
    nav.appendChild(link);
  }

  function insertThemeButton(nav) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.injectedNav = "true";
    button.className = "nav-link nav-utility-button";
    button.textContent = document.documentElement.dataset.theme === "dark" ? "Light Mode" : "Dark Mode";
    button.addEventListener("click", () => {
      const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(nextTheme);
      button.textContent = nextTheme === "dark" ? "Light Mode" : "Dark Mode";
    });
    nav.appendChild(button);
  }

  function interceptProfileGuestAccess(event) {
    event.preventDefault();
    redirectToLogin("Please log in first to view your profile.");
  }

  function renderSessionBanner(currentUser) {
    const banner = document.querySelector("[data-session-banner]");
    if (!banner) return;

    if (!currentUser) {
      banner.innerHTML = `
        <strong>Guest Mode</strong>
        <span>You can browse books, top-up, and orders, but you need to log in or sign up before using paid features.</span>
      `;
      return;
    }

    banner.innerHTML = `
      <strong>${escapeHtml(currentUser.username)}</strong>
      <span>Signed in as ${currentUser.role.replace("_", " ")} via ${formatAuthType(currentUser.authType || "password")}.</span>
    `;
  }

  function bindLogoutButtons() {
    document.querySelectorAll("[data-action='logout']").forEach((button) => {
      button.addEventListener("click", () => logout());
    });
  }

  function bindSocialButtons() {
    const feedback = document.querySelector("[data-auth-feedback]");
    const page = document.body.dataset.page || "";

    document.querySelectorAll("[data-social]").forEach((button) => {
      if (button.dataset.bound) return;
      button.dataset.bound = "true";
      button.addEventListener("click", async () => {
        await startSocialAuth(String(button.dataset.social || "").toLowerCase(), page, feedback);
      });
    });
  }

  async function startSocialAuth(provider, page, feedback) {
    const email = window.prompt(`Enter your ${formatAuthType(provider)} email address:`)?.trim().toLowerCase();
    if (!email) return;

    let account = await getAccountByEmail(email);
    if (account) {
      if (account.authType === "password") {
        setFeedback(feedback, `Signed in with ${formatAuthType(provider)} using your existing account.`, "success");
        await signInAccount(account, feedback, `Signed in with ${formatAuthType(provider)} using your existing account.`);
        return;
      }
      if (account.authType !== provider) {
        setFeedback(feedback, `This account uses ${formatAuthType(account.authType)} sign-in instead.`, "error");
        return;
      }
      await signInAccount(account, feedback, `Signed in with ${formatAuthType(provider)}.`);
      return;
    }

    const username = window.prompt(`Enter the display name for your ${formatAuthType(provider)} account:`)?.trim();
    if (!username) return;

    const id = await addRecord("accounts", {
      username,
      email,
      role: "user",
      authType: provider,
      passwordHash: "",
      contactNumber: "",
      address: "",
      createdAt: new Date().toISOString()
    });

    account = await getRecord("accounts", id);
    const message = page === "signup"
      ? `${formatAuthType(provider)} account created and signed in.`
      : `${formatAuthType(provider)} account was not found, so a new one was created and signed in.`;
    await signInAccount(account, feedback, message);
  }

  async function signInAccount(account, feedback, message) {
    localStorage.setItem(SESSION_KEY, String(account.id));
    setFeedback(feedback, message, "success");

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");

    window.setTimeout(() => {
      if (account.role === "super_admin") {
        window.location.href = "super-admin.html";
        return;
      }
      if (account.role === "admin") {
        window.location.href = "admin.html";
        return;
      }
      if (redirect === "profile") {
        window.location.href = "profile.html";
        return;
      }
      window.location.href = "index.html";
    }, 400);
  }

  async function renderProfile(currentUser) {
    if (!currentUser) return;
    setText("[data-profile='username']", currentUser.username || "Not set");
    setText("[data-profile='email']", currentUser.email);
    setText("[data-profile='role']", currentUser.role.replace("_", " "));
    setText("[data-profile='auth']", formatAuthType(currentUser.authType || "password"));
    setText("[data-profile='contact']", currentUser.contactNumber || "Not set");
    setText("[data-profile='address']", currentUser.address || "Not set");
    setText("[data-profile='initials']", buildInitials(currentUser.username || currentUser.email));
  }

  function bindTopup(currentUser) {
    const button = document.querySelector("[data-topup-submit]");
    const feedback = document.querySelector("[data-topup-feedback]");
    const input = document.getElementById("digicoin");
    if (!button || !input || button.dataset.bound) return;

    button.dataset.bound = "true";
    button.addEventListener("click", async () => {
      if (!currentUser) {
        setFeedback(feedback, "Please log in or sign up before buying DigiCoin.", "error");
        return;
      }

      const amount = Number(input.value || 0);
      if (!amount || amount < 1) {
        setFeedback(feedback, "Enter a valid DigiCoin amount.", "error");
        return;
      }

      await trackMetric("topup-uses");
      setFeedback(feedback, `${amount} DigiCoin top-up request saved for ${currentUser.username}.`, "success");
    });
  }

  async function renderOrders(currentUser) {
    const list = document.querySelector("[data-order-list]");
    const feedback = document.querySelector("[data-order-feedback]");
    if (!list) return;

    list.innerHTML = "";

    if (!currentUser) {
      if (feedback) setFeedback(feedback, "Log in to see your purchased chapters and completed orders.", "info");
      list.innerHTML = `<div class="empty-shelf">No account session yet. Sign in to start buying locked chapters.</div>`;
      return;
    }

    const orders = await getOrdersForAccount(currentUser.id);
    if (!orders.length) {
      if (feedback) setFeedback(feedback, "Your order list is empty.", "info");
      list.innerHTML = `<div class="empty-shelf">No purchases yet. Buy a locked chapter from any book to create an order.</div>`;
      return;
    }

    if (feedback) setFeedback(feedback, `${orders.length} order${orders.length === 1 ? "" : "s"} found.`, "success");

    orders
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .forEach((order) => {
        const card = document.createElement("article");
        card.className = "order-card";
        card.innerHTML = `
          <div>
            <p class="order-name">${escapeHtml(order.itemName)}</p>
            <p class="order-meta">${escapeHtml(order.orderNumber)} • ${formatDate(order.createdAt)}</p>
          </div>
          <span class="status-pill">${escapeHtml(order.status)}</span>
        `;
        list.appendChild(card);
      });
  }

  async function renderAdminDashboard(currentUser) {
    const books = await getBooks();
    const announcements = await getAllRecords("announcements");

    renderBookManagementList(books);
    renderAnnouncementManagementList(announcements);

    const profileCard = document.querySelector("[data-admin-profile]");
    if (profileCard && currentUser) {
      profileCard.innerHTML = `
        <div class="dashboard-profile">
          <div class="avatar-placeholder small"><span>${buildInitials(currentUser.username)}</span></div>
          <div>
            <p><strong>${escapeHtml(currentUser.username)}</strong></p>
            <p>${escapeHtml(currentUser.email)}</p>
            <p>${escapeHtml(currentUser.contactNumber || "No contact number set")}</p>
            <p>${escapeHtml(currentUser.address || "No address set")}</p>
          </div>
        </div>
      `;
    }

    bindAdminManagement();
  }

  function bindAdminManagement() {
    const feedback = document.querySelector("[data-admin-feedback]");
    const bookForm = document.querySelector("[data-admin-form='book']");
    const announcementForm = document.querySelector("[data-admin-form='announcement']");
    const booksList = document.querySelector("[data-admin-books]");
    const announcementsList = document.querySelector("[data-admin-announcements]");

    if (bookForm && !bookForm.dataset.bound) {
      bookForm.dataset.bound = "true";
      bookForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const formData = new FormData(bookForm);
          const id = Number(formData.get("id") || 0);
          const title = String(formData.get("title") || "").trim();
          const genre = String(formData.get("genre") || "").trim();
          const description = String(formData.get("description") || "").trim();
          const imageFile = formData.get("image");

          if (!title || !genre || !description) {
            setFeedback(feedback, "Book title, genre, and description are required.", "error");
            return;
          }

          let book = id ? await getRecord("books", id) : null;
          if (!book) {
            book = createEmptyBook();
          }

          let imageDataUrl = book.imageDataUrl || "";
          if (imageFile instanceof File && imageFile.size) {
            imageDataUrl = await processImageFile(imageFile);
          }

          const nextBook = {
            ...book,
            title,
            genre,
            description,
            imageDataUrl,
            createdAt: book.createdAt || new Date().toISOString(),
            chapters: Array.isArray(book.chapters) ? book.chapters : [],
            totalViews: Number(book.totalViews || 0),
            todayViews: Number(book.todayViews || 0),
            todayViewDate: book.todayViewDate || getTodayKey()
          };

          if (id) {
            await putRecord("books", { ...nextBook, id });
          } else {
            const newId = await addRecord("books", nextBook);
            nextBook.id = newId;
          }

          window.location.href = `edit-book.html?bookId=${nextBook.id}`;
        } catch (error) {
          setFeedback(feedback, "Unable to save this book right now. Try a smaller image or save without an image first.", "error");
        }
      });
    }

    if (booksList && !booksList.dataset.bound) {
      booksList.dataset.bound = "true";
      booksList.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-edit-book]");
        if (editButton) {
          window.location.href = `edit-book.html?bookId=${Number(editButton.dataset.editBook)}`;
          return;
        }

        const deleteButton = event.target.closest("[data-delete-book]");
        if (!deleteButton) return;
        await deleteRecord("books", Number(deleteButton.dataset.deleteBook));
        const books = await getBooks();
        renderBookManagementList(books);
        setStat("[data-stat='books']", books.length);
        resetBookForm();
        setFeedback(feedback, "Book removed.", "success");
      });
    }

    if (announcementForm && !announcementForm.dataset.bound) {
      announcementForm.dataset.bound = "true";
      announcementForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(announcementForm);
        const title = String(formData.get("title") || "").trim();
        if (!title) {
          setFeedback(feedback, "Announcement text is required.", "error");
          return;
        }
        await addRecord("announcements", { title });
        renderAnnouncementManagementList(await getAllRecords("announcements"));
        announcementForm.reset();
        setFeedback(feedback, "Announcement added.", "success");
      });
    }

    if (announcementsList && !announcementsList.dataset.bound) {
      announcementsList.dataset.bound = "true";
      announcementsList.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-delete-announcement]");
        if (!button) return;
        await deleteRecord("announcements", Number(button.dataset.deleteAnnouncement));
        renderAnnouncementManagementList(await getAllRecords("announcements"));
      });
    }
  }

  async function renderSuperAdminDashboard(currentUser) {
    await renderAdminDashboard(currentUser);
    const accounts = await getAllRecords("accounts");
    const orders = await getAllRecords("orders");
    const books = await getBooks();
    const metrics = await getAllRecords("metrics");

    setStat("[data-stat='users']", accounts.filter((account) => account.role === "user").length);
    setStat("[data-stat='admins']", accounts.filter((account) => account.role === "admin").length);
    setStat("[data-stat='super-admins']", accounts.filter((account) => account.role === "super_admin").length);
    setStat("[data-stat='orders']", orders.length);
    setStat("[data-stat='books']", books.length);
    setStat("[data-stat='views']", sumMetricValues(metrics.filter((metric) => metric.key.startsWith("page:"))));

    renderAccountsTable(accounts);
    bindAccountManagement();
  }

  async function renderEditBookPage(currentUser) {
    const bookId = Number(new URLSearchParams(window.location.search).get("bookId") || 0);
    const feedback = document.querySelector("[data-admin-feedback]");
    const returnLink = document.querySelector("[data-admin-return]");
    if (returnLink) {
      returnLink.href = currentUser?.role === "super_admin" ? "super-admin.html" : "admin.html";
    }

    if (!bookId) {
      if (feedback) setFeedback(feedback, "Select a book from the dashboard first.", "error");
      return;
    }

    const book = await getRecord("books", bookId);
    if (!book) {
      if (feedback) setFeedback(feedback, "That book could not be found.", "error");
      return;
    }

    const heading = document.querySelector("[data-edit-book-heading]");
    if (heading) heading.textContent = book.title;

    renderBookForm(book);
    renderChapterManagement(book);
    bindEditBookManagement();
  }

  function bindEditBookManagement() {
    const feedback = document.querySelector("[data-admin-feedback]");
    const bookForm = document.querySelector("[data-admin-form='book']");
    const chapterForm = document.querySelector("[data-admin-form='chapter']");
    const chaptersList = document.querySelector("[data-admin-chapters]");

    if (bookForm && !bookForm.dataset.bound) {
      bookForm.dataset.bound = "true";
      bookForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          const formData = new FormData(bookForm);
          const id = Number(formData.get("id") || 0);
          const title = String(formData.get("title") || "").trim();
          const genre = String(formData.get("genre") || "").trim();
          const description = String(formData.get("description") || "").trim();
          const imageFile = formData.get("image");

          if (!id) {
            setFeedback(feedback, "Open a valid book first.", "error");
            return;
          }

          if (!title || !genre || !description) {
            setFeedback(feedback, "Book title, genre, and description are required.", "error");
            return;
          }

          const book = await getRecord("books", id);
          if (!book) {
            setFeedback(feedback, "That book could not be found.", "error");
            return;
          }

          let imageDataUrl = book.imageDataUrl || "";
          if (imageFile instanceof File && imageFile.size) {
            imageDataUrl = await processImageFile(imageFile);
          }

          const updatedBook = {
            ...book,
            title,
            genre,
            description,
            imageDataUrl
          };

          await putRecord("books", updatedBook);
          const heading = document.querySelector("[data-edit-book-heading]");
          if (heading) heading.textContent = updatedBook.title;
          renderBookForm(updatedBook);
          renderChapterManagement(updatedBook);
          setFeedback(feedback, "Book details updated.", "success");
        } catch {
          setFeedback(feedback, "Unable to update this book right now.", "error");
        }
      });
    }

    if (chapterForm && !chapterForm.dataset.bound) {
      chapterForm.dataset.bound = "true";
      chapterForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(chapterForm);
        const bookId = Number(formData.get("bookId") || 0);
        const chapterId = String(formData.get("chapterId") || "");
        const title = String(formData.get("title") || "").trim();
        const text = String(formData.get("text") || "").trim();
        const accessType = String(formData.get("accessType") || "free");

        if (!bookId) {
          setFeedback(feedback, "Open a valid book first.", "error");
          return;
        }

        if (!title || !text) {
          setFeedback(feedback, "Chapter title and chapter text are required.", "error");
          return;
        }

        const book = await getRecord("books", bookId);
        if (!book) return;

        const chapters = Array.isArray(book.chapters) ? [...book.chapters] : [];
        const nextChapter = {
          id: chapterId || createChapterId(),
          title,
          text,
          isPaid: accessType === "paid"
        };

        const existingIndex = chapters.findIndex((chapter) => chapter.id === chapterId);
        if (existingIndex >= 0) {
          chapters[existingIndex] = nextChapter;
        } else {
          chapters.push(nextChapter);
        }

        const updatedBook = { ...book, chapters };
        await putRecord("books", updatedBook);
        renderChapterManagement(updatedBook);
        setFeedback(feedback, existingIndex >= 0 ? "Chapter updated." : "Chapter added.", "success");
      });
    }

    if (chaptersList && !chaptersList.dataset.bound) {
      chaptersList.dataset.bound = "true";
      chaptersList.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-edit-chapter]");
        if (editButton) {
          const bookId = Number(editButton.dataset.bookId);
          const chapterId = String(editButton.dataset.editChapter || "");
          const book = await getRecord("books", bookId);
          if (!book) return;
          const chapter = (book.chapters || []).find((item) => item.id === chapterId);
          if (!chapter) return;
          renderChapterManagement(book, chapter);
          setFeedback(feedback, `Editing chapter "${chapter.title}".`, "info");
          return;
        }

        const deleteButton = event.target.closest("[data-delete-chapter]");
        if (!deleteButton) return;
        const bookId = Number(deleteButton.dataset.bookId);
        const chapterId = String(deleteButton.dataset.deleteChapter || "");
        const book = await getRecord("books", bookId);
        if (!book) return;
        const updatedBook = {
          ...book,
          chapters: (book.chapters || []).filter((chapter) => chapter.id !== chapterId)
        };
        await putRecord("books", updatedBook);
        renderChapterManagement(updatedBook);
        setFeedback(feedback, "Chapter removed.", "success");
      });
    }
  }

  function bindAccountManagement() {
    const form = document.querySelector("[data-account-form]");
    const feedback = document.querySelector("[data-super-feedback]");
    const table = document.querySelector("[data-account-table]");
    if (!form) return;

    if (!form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const id = Number(formData.get("id") || 0);
        const username = String(formData.get("username") || "").trim();
        const email = String(formData.get("email") || "").trim().toLowerCase();
        const password = String(formData.get("password") || "");
        const role = String(formData.get("role") || "user");
        const authType = String(formData.get("authType") || "password");
        const contactNumber = String(formData.get("contactNumber") || "").trim();
        const address = String(formData.get("address") || "").trim();

        if (!username || !email) {
          setFeedback(feedback, "Username and email are required.", "error");
          return;
        }

        const existing = await getAccountByEmail(email);
        if (existing && existing.id !== id) {
          setFeedback(feedback, "Another account already uses that email.", "error");
          return;
        }

        if (!id && authType === "password" && password.length < 8) {
          setFeedback(feedback, "Password accounts need at least 8 characters.", "error");
          return;
        }

        if (id) {
          const account = await getRecord("accounts", id);
          if (!account) return;
          const updated = { ...account, username, email, role, authType, contactNumber, address };
          if (authType === "password" && password) updated.passwordHash = await hashPassword(password);
          if (authType !== "password") updated.passwordHash = "";
          await putRecord("accounts", updated);
          setFeedback(feedback, "Account updated.", "success");
        } else {
          await addRecord("accounts", {
            username,
            email,
            role,
            authType,
            passwordHash: authType === "password" ? await hashPassword(password) : "",
            contactNumber,
            address,
            createdAt: new Date().toISOString()
          });
          setFeedback(feedback, "Account created.", "success");
        }

        form.reset();
        form.querySelector("[name='id']").value = "";
        form.querySelector("[name='authType']").value = "password";
        await refreshSuperAdminData();
      });
    }

    if (table && !table.dataset.bound) {
      table.dataset.bound = "true";
      table.addEventListener("click", async (event) => {
        const editButton = event.target.closest("[data-edit-account]");
        if (editButton) {
          const account = await getRecord("accounts", Number(editButton.dataset.editAccount));
          if (!account) return;
          form.querySelector("[name='id']").value = String(account.id);
          form.querySelector("[name='username']").value = account.username || "";
          form.querySelector("[name='email']").value = account.email || "";
          form.querySelector("[name='password']").value = "";
          form.querySelector("[name='role']").value = account.role || "user";
          form.querySelector("[name='authType']").value = account.authType || "password";
          form.querySelector("[name='contactNumber']").value = account.contactNumber || "";
          form.querySelector("[name='address']").value = account.address || "";
          return;
        }

        const deleteButton = event.target.closest("[data-delete-account]");
        if (!deleteButton) return;
        const accountId = Number(deleteButton.dataset.deleteAccount);
        const currentUserId = Number(localStorage.getItem(SESSION_KEY) || 0);
        if (accountId === currentUserId) {
          setFeedback(feedback, "You cannot delete the account you are currently using.", "error");
          return;
        }
        await deleteRecord("accounts", accountId);
        setFeedback(feedback, "Account deleted.", "success");
        await refreshSuperAdminData();
      });
    }
  }

  async function refreshSuperAdminData() {
    const accounts = await getAllRecords("accounts");
    const books = await getBooks();
    const orders = await getAllRecords("orders");
    renderAccountsTable(accounts);
    setStat("[data-stat='users']", accounts.filter((account) => account.role === "user").length);
    setStat("[data-stat='admins']", accounts.filter((account) => account.role === "admin").length);
    setStat("[data-stat='super-admins']", accounts.filter((account) => account.role === "super_admin").length);
    setStat("[data-stat='books']", books.length);
    setStat("[data-stat='orders']", orders.length);
    bindAccountManagement();
  }

  function renderBookManagementList(books) {
    const container = document.querySelector("[data-admin-books]");
    if (!container) return;

    if (!books.length) {
      container.innerHTML = `<p class="muted-copy">No books added yet.</p>`;
      return;
    }

    container.innerHTML = books
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .map((book) => `
        <article class="management-card media-card">
          <div class="management-media">
            <img src="${book.imageDataUrl}" alt="${escapeHtml(book.title)} cover">
          </div>
          <div class="management-content">
            <p>${escapeHtml(book.title)}</p>
            <span>${escapeHtml(book.genre)} • ${(book.chapters || []).length} chapters</span>
            <span>${Number(book.totalViews || 0)} all-time views • ${Number(book.todayViews || 0)} today</span>
          </div>
          <div class="table-actions wrap-actions">
            <button class="ghost-button inline" type="button" data-edit-book="${book.id}">Edit</button>
            <button class="ghost-button inline danger" type="button" data-delete-book="${book.id}">Delete</button>
          </div>
        </article>
      `)
      .join("");
  }

  function renderAnnouncementManagementList(items) {
    const container = document.querySelector("[data-admin-announcements]");
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `<p class="muted-copy">No announcements added yet.</p>`;
      return;
    }

    container.innerHTML = items
      .map((item) => `
        <article class="management-card">
          <div class="management-content">
            <p>${escapeHtml(item.title)}</p>
          </div>
          <button class="ghost-button inline" type="button" data-delete-announcement="${item.id}">Remove</button>
        </article>
      `)
      .join("");
  }

  function renderBookForm(book) {
    const form = document.querySelector("[data-admin-form='book']");
    if (!form) return;
    form.querySelector("[name='id']").value = String(book.id || "");
    form.querySelector("[name='title']").value = book.title || "";
    form.querySelector("[name='genre']").value = book.genre || "";
    form.querySelector("[name='description']").value = book.description || "";
    const heading = document.querySelector("[data-book-editor-title]");
    if (heading) heading.textContent = book.id ? `Editing ${book.title}` : "Create Book";
  }

  function resetBookForm() {
    const form = document.querySelector("[data-admin-form='book']");
    if (!form) return;
    form.reset();
    form.querySelector("[name='id']").value = "";
    const heading = document.querySelector("[data-book-editor-title]");
    if (heading) heading.textContent = "Create Book";
  }

  function renderChapterManagement(book, chapterToEdit = null) {
    const titleNode = document.querySelector("[data-chapter-book-title]");
    const listNode = document.querySelector("[data-admin-chapters]");
    const form = document.querySelector("[data-admin-form='chapter']");
    if (!titleNode || !listNode || !form) return;

    if (!book) {
      titleNode.textContent = "Select or save a book first";
      listNode.innerHTML = `<p class="muted-copy">Book chapters will appear here after you create or edit a book.</p>`;
      form.reset();
      form.querySelector("[name='bookId']").value = "";
      form.querySelector("[name='chapterId']").value = "";
      return;
    }

    titleNode.textContent = `Chapters for ${book.title}`;
    form.querySelector("[name='bookId']").value = String(book.id);
    form.querySelector("[name='chapterId']").value = chapterToEdit?.id || "";
    form.querySelector("[name='title']").value = chapterToEdit?.title || "";
    form.querySelector("[name='text']").value = chapterToEdit?.text || "";
    form.querySelector("[name='accessType']").value = chapterToEdit?.isPaid ? "paid" : "free";

    const chapters = Array.isArray(book.chapters) ? book.chapters : [];
    if (!chapters.length) {
      listNode.innerHTML = `<p class="muted-copy">No chapters added yet.</p>`;
      return;
    }

    listNode.innerHTML = chapters
      .map((chapter, index) => `
        <article class="management-card">
          <div class="management-content">
            <p>Chapter ${index + 1}: ${escapeHtml(chapter.title)}</p>
            <span>${chapter.isPaid ? "Buyable" : "Free"}</span>
          </div>
          <div class="table-actions wrap-actions">
            <button class="ghost-button inline" type="button" data-book-id="${book.id}" data-edit-chapter="${chapter.id}">Edit</button>
            <button class="ghost-button inline danger" type="button" data-book-id="${book.id}" data-delete-chapter="${chapter.id}">Delete</button>
          </div>
        </article>
      `)
      .join("");
  }

  function renderAccountsTable(accounts) {
    const tbody = document.querySelector("[data-account-table]");
    if (!tbody) return;

    tbody.innerHTML = "";
    accounts
      .sort((a, b) => a.email.localeCompare(b.email))
      .forEach((account) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${escapeHtml(account.username)}</td>
          <td>${escapeHtml(account.email)}</td>
          <td>${escapeHtml(account.role.replace("_", " "))}</td>
          <td>${formatAuthType(account.authType || "password")}</td>
          <td>${escapeHtml(account.contactNumber || "-")}</td>
          <td class="table-actions">
            <button class="ghost-button inline" type="button" data-edit-account="${account.id}">Edit</button>
            <button class="ghost-button inline danger" type="button" data-delete-account="${account.id}">Delete</button>
          </td>
        `;
        tbody.appendChild(row);
      });
  }

  function setStat(selector, value) {
    const element = document.querySelector(selector);
    if (element) element.textContent = String(value);
  }

  function sumMetricValues(metrics) {
    return metrics.reduce((total, metric) => total + Number(metric.value || 0), 0);
  }

  async function getBooks() {
    const books = await getAllRecords("books");
    return books.map(normalizeBookRecord);
  }

  async function getBookById(id) {
    const book = await getRecord("books", Number(id));
    return book ? normalizeBookRecord(book) : null;
  }

  function normalizeBookRecord(book) {
    const todayKey = getTodayKey();
    const isCurrentDay = (book.todayViewDate || todayKey) === todayKey;
    return {
      ...book,
      chapters: Array.isArray(book.chapters) ? book.chapters : [],
      totalViews: Number(book.totalViews || 0),
      todayViews: isCurrentDay ? Number(book.todayViews || 0) : 0,
      todayViewDate: book.todayViewDate || todayKey
    };
  }

  async function incrementBookView(bookId) {
    const book = await getBookById(bookId);
    if (!book) return null;
    const todayKey = getTodayKey();
    const nextTodayViews = book.todayViewDate === todayKey ? book.todayViews + 1 : 1;
    const updated = {
      ...book,
      totalViews: book.totalViews + 1,
      todayViews: nextTodayViews,
      todayViewDate: todayKey
    };
    await putRecord("books", updated);
    return updated;
  }

  async function getChapterAccess(bookId, chapterId) {
    const currentUser = await getCurrentUser();
    const book = await getBookById(bookId);
    if (!book) {
      return { canRead: false, purchased: false, requiresPurchase: false, isGuest: !currentUser };
    }

    const chapter = (book.chapters || []).find((item) => item.id === chapterId);
    if (!chapter) {
      return { canRead: false, purchased: false, requiresPurchase: false, isGuest: !currentUser };
    }

    if (!chapter.isPaid) {
      return { canRead: true, purchased: false, requiresPurchase: false, isGuest: !currentUser };
    }

    if (currentUser && ["admin", "super_admin"].includes(currentUser.role)) {
      return { canRead: true, purchased: true, requiresPurchase: false, isGuest: false };
    }

    if (!currentUser) {
      return { canRead: false, purchased: false, requiresPurchase: true, isGuest: true };
    }

    const purchased = await hasPurchasedChapter(currentUser.id, bookId, chapterId);
    return {
      canRead: purchased,
      purchased,
      requiresPurchase: !purchased,
      isGuest: false
    };
  }

  async function purchaseChapter(bookId, chapterId) {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { ok: false, message: "Please log in or sign up before buying locked chapters." };
    }

    const book = await getBookById(bookId);
    if (!book) return { ok: false, message: "Book not found." };
    const chapter = (book.chapters || []).find((item) => item.id === chapterId);
    if (!chapter) return { ok: false, message: "Chapter not found." };
    if (!chapter.isPaid) return { ok: true, message: "This chapter is already free to read." };

    if (["admin", "super_admin"].includes(currentUser.role)) {
      return { ok: true, message: "Admin accounts can read buyable chapters without purchasing." };
    }

    if (await hasPurchasedChapter(currentUser.id, bookId, chapterId)) {
      return { ok: true, message: "You already bought this chapter." };
    }

    await addRecord("orders", {
      accountId: currentUser.id,
      bookId,
      chapterId,
      itemName: `${book.title} - ${chapter.title}`,
      itemType: "chapter",
      status: "Purchased",
      orderNumber: createOrderNumber(),
      createdAt: new Date().toISOString()
    });

    return { ok: true, message: `You bought ${chapter.title}. It is now unlocked in your account.` };
  }

  async function hasPurchasedChapter(accountId, bookId, chapterId) {
    const orders = await getOrdersForAccount(accountId);
    return orders.some((order) => order.bookId === bookId && order.chapterId === chapterId && order.status === "Purchased");
  }

  async function getOrdersForAccount(accountId) {
    const orders = await getAllRecords("orders");
    return orders.filter((order) => order.accountId === accountId);
  }

  async function getCurrentUser() {
    const currentId = Number(localStorage.getItem(SESSION_KEY) || 0);
    if (!currentId) return null;
    return getRecord("accounts", currentId);
  }

  async function getAccountByEmail(email) {
    if (storageMode === "local") {
      const db = readLocalDb();
      return db.accounts.find((account) => account.email === email) || null;
    }
    const db = await ensureDatabase();
    if (!db) {
      storageMode = "local";
      return getAccountByEmail(email);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction("accounts", "readonly");
      const request = tx.objectStore("accounts").index("email").get(email);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function getAllRecords(storeName) {
    if (storageMode === "local") {
      const db = readLocalDb();
      return [...(db[storeName] || [])];
    }
    const db = await ensureDatabase();
    if (!db) {
      storageMode = "local";
      return getAllRecords(storeName);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async function getRecord(storeName, key) {
    if (storageMode === "local") {
      const db = readLocalDb();
      const collection = db[storeName] || [];
      if (storeName === "metrics") {
        return collection.find((item) => item.key === key) || null;
      }
      return collection.find((item) => Number(item.id) === Number(key)) || null;
    }
    const db = await ensureDatabase();
    if (!db) {
      storageMode = "local";
      return getRecord(storeName, key);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readonly");
      const request = tx.objectStore(storeName).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function addRecord(storeName, value) {
    if (storageMode === "local") {
      const db = readLocalDb();
      const collection = db[storeName] || [];
      const record = storeName === "metrics" ? { ...value } : { ...value, id: nextLocalId(collection) };
      collection.push(record);
      db[storeName] = collection;
      writeLocalDb(db);
      return storeName === "metrics" ? record.key : record.id;
    }
    const db = await ensureDatabase();
    if (!db) {
      storageMode = "local";
      return addRecord(storeName, value);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).add(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function putRecord(storeName, value) {
    if (storageMode === "local") {
      const db = readLocalDb();
      const collection = db[storeName] || [];
      if (storeName === "metrics") {
        const next = collection.filter((item) => item.key !== value.key);
        next.push({ ...value });
        db[storeName] = next;
        writeLocalDb(db);
        return value.key;
      }
      const next = collection.filter((item) => Number(item.id) !== Number(value.id));
      next.push({ ...value });
      db[storeName] = next;
      writeLocalDb(db);
      return value.id;
    }
    const db = await ensureDatabase();
    if (!db) {
      storageMode = "local";
      return putRecord(storeName, value);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).put(value);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function deleteRecord(storeName, key) {
    if (storageMode === "local") {
      const db = readLocalDb();
      const collection = db[storeName] || [];
      db[storeName] = storeName === "metrics"
        ? collection.filter((item) => item.key !== key)
        : collection.filter((item) => Number(item.id) !== Number(key));
      writeLocalDb(db);
      return;
    }
    const db = await ensureDatabase();
    if (!db) {
      storageMode = "local";
      return deleteRecord(storeName, key);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function clearStore(storeName) {
    if (storageMode === "local") {
      const db = readLocalDb();
      db[storeName] = [];
      writeLocalDb(db);
      return;
    }
    const db = await ensureDatabase();
    if (!db) {
      storageMode = "local";
      return clearStore(storeName);
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, "readwrite");
      const request = tx.objectStore(storeName).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function trackMetric(key) {
    const existing = await getRecord("metrics", key);
    await putRecord("metrics", { key, value: Number(existing?.value || 0) + 1 });
  }

  async function hashPassword(password) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(password));
    return Array.from(new Uint8Array(buffer))
      .map((part) => part.toString(16).padStart(2, "0"))
      .join("");
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function processImageFile(file) {
    const original = await fileToDataUrl(file);

    try {
      return await compressImageDataUrl(original);
    } catch {
      return original;
    }
  }

  function compressImageDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const maxWidth = 600;
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("Canvas context unavailable"));
          return;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.onerror = () => reject(new Error("Image compression failed"));
      image.src = dataUrl;
    });
  }

  function createEmptyBook() {
    return {
      title: "",
      genre: "",
      description: "",
      imageDataUrl: "",
      createdAt: new Date().toISOString(),
      totalViews: 0,
      todayViews: 0,
      todayViewDate: getTodayKey(),
      chapters: []
    };
  }

  function createChapterId() {
    return `chapter-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  }

  function createOrderNumber() {
    return `#NBS-${Math.floor(100000 + Math.random() * 900000)}`;
  }

  function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatDate(value) {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function setFeedback(node, message, state) {
    if (!node) return;
    node.textContent = message;
    node.dataset.state = state;
  }

  function setText(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  }

  function buildInitials(value) {
    return String(value || "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "NB";
  }

  function formatAuthType(authType) {
    if (authType === "google") return "Google";
    if (authType === "facebook") return "Facebook";
    return "Password";
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
    window.location.href = "login.html";
  }

  function applyTheme(theme = localStorage.getItem(THEME_KEY) || "light") {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }

  function readLocalDb() {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        return {
          accounts: parsed.accounts || [],
          books: parsed.books || [],
          announcements: parsed.announcements || [],
          orders: parsed.orders || [],
          metrics: parsed.metrics || []
        };
      } catch {
        return { accounts: [], books: [], announcements: [], orders: [], metrics: [] };
      }
    }
    return { accounts: [], books: [], announcements: [], orders: [], metrics: [] };
  }

  function writeLocalDb(db) {
    localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
  }

  function nextLocalId(items) {
    return items.reduce((max, item) => Math.max(max, Number(item.id || 0)), 0) + 1;
  }
})();
