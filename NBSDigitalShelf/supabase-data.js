import {
  STORAGE_BUCKETS,
  buildStoragePath,
  createTextFile,
  delay,
  fileExtension,
  getCurrentDayKey,
  getLoginRedirectUrl,
  getProviderLabel,
  getPublicBucketUrl,
  isAdminRole,
  makeOrderNumber,
  supabase
} from "./supabase-client.js";

let cachedProfile = null;

function throwIfError(error, fallbackMessage) {
  if (error) throw new Error(error.message || fallbackMessage);
}

function usernameFromUser(user) {
  return (
    user?.user_metadata?.username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "Reader"
  );
}

function normalizeProfile(profile, session) {
  if (!profile) return null;
  return {
    id: profile.id,
    email: profile.email || session?.user?.email || "",
    username: profile.username || usernameFromUser(session?.user),
    role: profile.role || "user",
    contactNumber: profile.contact_number || "",
    address: profile.address || "",
    avatarPath: profile.avatar_path || "",
    avatarUrl: profile.avatar_path ? getPublicBucketUrl(STORAGE_BUCKETS.profileAvatars, profile.avatar_path) : "",
    authType: session?.user?.app_metadata?.provider || "password",
    createdAt: profile.created_at || ""
  };
}

async function ensureProfileRow(session) {
  if (!session?.user) return null;

  const payload = {
    id: session.user.id,
    email: session.user.email || "",
    username: usernameFromUser(session.user),
    contact_number: session.user.user_metadata?.contact_number || "",
    address: session.user.user_metadata?.address || ""
  };

  const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
  throwIfError(error, "Unable to prepare the profile.");
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  throwIfError(error, "Unable to read the current session.");
  return data.session || null;
}

export async function getCurrentProfile(force = false) {
  if (!force && cachedProfile) return cachedProfile;

  const session = await getSession();
  if (!session?.user) {
    cachedProfile = null;
    return null;
  }

  await ensureProfileRow(session);
  const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
  throwIfError(error, "Unable to load the current profile.");

  cachedProfile = normalizeProfile(data, session);
  return cachedProfile;
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  throwIfError(error, "Unable to sign in.");
  cachedProfile = null;
  return data;
}

export async function signUpWithPassword({ username, email, password, contactNumber, address }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        contact_number: contactNumber,
        address
      }
    }
  });
  throwIfError(error, "Unable to create the account.");
  cachedProfile = null;
  return data;
}

export async function signInWithOAuth(provider, next = "index.html") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getLoginRedirectUrl(next)
    }
  });
  throwIfError(error, `Unable to start ${getProviderLabel(provider)} sign in.`);
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  throwIfError(error, "Unable to sign out.");
  cachedProfile = null;
}

function sortChapters(chapters) {
  return [...chapters].sort((a, b) => {
    const left = Number(a.chapter_order || 0);
    const right = Number(b.chapter_order || 0);
    if (left !== right) return left - right;
    return String(a.title || "").localeCompare(String(b.title || ""));
  });
}

function mapBookRecord(book, chapters, views, favorites, currentProfile) {
  const bookChapters = sortChapters(chapters.filter((chapter) => chapter.book_id === book.id));
  const bookViews = views.filter((view) => view.book_id === book.id);
  const bookFavorites = favorites.filter((favorite) => favorite.book_id === book.id);
  const todayKey = getCurrentDayKey();

  return {
    id: book.id,
    title: book.title,
    genre: book.genre,
    description: book.description,
    imagePath: book.cover_path || "",
    imageUrl: book.cover_path ? getPublicBucketUrl(STORAGE_BUCKETS.bookCovers, book.cover_path) : "",
    imageDataUrl: book.cover_path ? getPublicBucketUrl(STORAGE_BUCKETS.bookCovers, book.cover_path) : "",
    createdAt: book.created_at,
    updatedAt: book.updated_at,
    chapterCount: bookChapters.length,
    lockedCount: bookChapters.filter((chapter) => chapter.is_paid).length,
    totalViews: bookViews.length,
    todayViews: bookViews.filter((view) => String(view.created_at || "").slice(0, 10) === todayKey).length,
    favoriteCount: bookFavorites.length,
    isFavorite: Boolean(currentProfile && bookFavorites.some((favorite) => favorite.profile_id === currentProfile.id)),
    chapters: bookChapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      isPaid: Boolean(chapter.is_paid),
      filePath: chapter.file_path,
      chapterOrder: chapter.chapter_order,
      createdAt: chapter.created_at,
      updatedAt: chapter.updated_at
    }))
  };
}

async function fetchBookData(bookIds = null) {
  const currentProfilePromise = getCurrentProfile();

  const booksQuery = supabase.from("books").select("*").order("created_at", { ascending: false });
  const chaptersQuery = supabase.from("chapters").select("*");
  const viewsQuery = supabase.from("book_views").select("book_id, created_at");
  const favoritesQuery = supabase.from("favorites").select("book_id, profile_id");

  if (Array.isArray(bookIds) && bookIds.length) {
    booksQuery.in("id", bookIds);
    chaptersQuery.in("book_id", bookIds);
    viewsQuery.in("book_id", bookIds);
    favoritesQuery.in("book_id", bookIds);
  }

  const [currentProfile, booksRes, chaptersRes, viewsRes, favoritesRes] = await Promise.all([
    currentProfilePromise,
    booksQuery,
    chaptersQuery,
    viewsQuery,
    favoritesQuery
  ]);

  throwIfError(booksRes.error, "Unable to load books.");
  throwIfError(chaptersRes.error, "Unable to load chapters.");
  throwIfError(viewsRes.error, "Unable to load view counts.");
  throwIfError(favoritesRes.error, "Unable to load favorites.");

  const books = booksRes.data || [];
  const chapters = chaptersRes.data || [];
  const views = viewsRes.data || [];
  const favorites = favoritesRes.data || [];

  return books.map((book) => mapBookRecord(book, chapters, views, favorites, currentProfile));
}

export async function getBooks() {
  return fetchBookData();
}

async function getPurchasedChapterIds(bookId, profile) {
  if (!profile || isAdminRole(profile.role)) return new Set();

  const { data, error } = await supabase
    .from("orders")
    .select("chapter_id")
    .eq("profile_id", profile.id)
    .eq("book_id", bookId)
    .eq("status", "Purchased");

  throwIfError(error, "Unable to load chapter access.");
  return new Set((data || []).map((item) => item.chapter_id));
}

async function enrichBookChaptersWithText(book) {
  if (!book || !Array.isArray(book.chapters) || !book.chapters.length) {
    return book;
  }

  const chaptersWithText = [];
  for (const ch of book.chapters) {
    if (!ch.filePath) {
      chaptersWithText.push({ ...ch, text: "" });
      continue;
    }

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.chapterFiles)
      .download(ch.filePath);

    if (error || !data) {
      console.error("Failed to download chapter file", ch.filePath, error);
      chaptersWithText.push({ ...ch, text: "" });
      continue;
    }

    const text = await data.text();
    chaptersWithText.push({ ...ch, text });
  }

  return { ...book, chapters: chaptersWithText };
}

export async function getBookById(bookId) {
  const [profile, books] = await Promise.all([
    getCurrentProfile(),
    fetchBookData([bookId]),
  ]);
  const book = books.find((item) => item.id === bookId) || null;
  if (!book) return null;

  const purchasedChapterIds = await getPurchasedChapterIds(bookId, profile);

  const bookWithAccess = {
    ...book,
    chapters: book.chapters.map((chapter) => {
      if (!chapter.isPaid) {
        return {
          ...chapter,
          canRead: true,
          purchased: false,
          requiresPurchase: false,
          isGuest: !profile,
        };
      }

      const purchased = purchasedChapterIds.has(chapter.id);

      return {
        ...chapter,
        canRead: purchased || isAdminRole(profile?.role),
        purchased,
        requiresPurchase: !purchased,
        isGuest: !profile,
      };
    }),
  };

  return await enrichBookChaptersWithText(bookWithAccess);
}

export async function getChapterAccess(bookId, chapterId) {
  const profile = await getCurrentProfile();
  const book = await getBookById(bookId);

  if (!book) return null;

  const chapter = book.chapters?.find((ch) => ch.id === chapterId);
  if (!chapter) return null;

  return {
    canRead: chapter.canRead,
    requiresPurchase: chapter.requiresPurchase,
    isGuest: !profile
  };
}

export async function getAnnouncements() {
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  throwIfError(error, "Unable to load announcements.");
  return data || [];
}

export async function trackPageView(pageName) {
  const profile = await getCurrentProfile();
  const { error } = await supabase.from("page_views").insert({
    page_name: pageName,
    viewer_id: profile?.id || null
  });

  throwIfError(error, "Unable to track page view.");
}

export async function incrementBookView(bookId) {
  const profile = await getCurrentProfile();
  const { error } = await supabase.from("book_views").insert({
    book_id: bookId,
    viewer_id: profile?.id || null
  });

  throwIfError(error, "Unable to track book view.");
}

export async function toggleFavorite(bookId) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { ok: false, status: 401, message: "Please log in first to save books." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("favorites")
    .select("book_id")
    .eq("profile_id", profile.id)
    .eq("book_id", bookId)
    .maybeSingle();

  throwIfError(existingError, "Unable to check your favorites.");

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("profile_id", profile.id)
      .eq("book_id", bookId);

    throwIfError(error, "Unable to remove the favorite.");
    return { ok: true, saved: false, message: "Removed from My Books." };
  }

  const { error } = await supabase.from("favorites").insert({
    profile_id: profile.id,
    book_id: bookId
  });

  throwIfError(error, "Unable to save the book.");
  return { ok: true, saved: true, message: "Saved to My Books." };
}

export async function getMyBooks() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Please log in first to view My Books.");

  const { data, error } = await supabase.from("favorites").select("book_id").eq("profile_id", profile.id);
  throwIfError(error, "Unable to load My Books.");

  const bookIds = (data || []).map((item) => item.book_id);
  if (!bookIds.length) return [];

  const books = await fetchBookData(bookIds);
  return books.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function downloadChapterText(filePath) {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKETS.chapterFiles).download(filePath);
  throwIfError(error, "Unable to load the chapter text.");
  return data.text();
}

export async function purchaseChapter(bookId, chapterId) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return { ok: false, status: 401, message: "Please log in or sign up before buying locked chapters." };
  }

  const book = await getBookById(bookId);
  if (!book) return { ok: false, message: "Book not found." };

  const chapter = (book.chapters || []).find((item) => item.id === chapterId);
  if (!chapter) return { ok: false, message: "Chapter not found." };
  if (!chapter.isPaid) return { ok: true, message: "This chapter is already free to read." };
  if (isAdminRole(profile.role)) return { ok: true, message: "Admin accounts can read buyable chapters without purchasing." };
  if (chapter.purchased) return { ok: true, message: "You already bought this chapter." };

  const { error } = await supabase.from("orders").insert({
    profile_id: profile.id,
    book_id: bookId,
    chapter_id: chapterId,
    item_name: `${book.title} - ${chapter.title}`,
    item_type: "chapter",
    status: "Purchased",
    order_number: makeOrderNumber()
  });

  throwIfError(error, "Unable to save the purchase.");
  return { ok: true, message: `You bought ${chapter.title}. It is now unlocked in your account.` };
}

export async function createTopupOrder(amount) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Please log in or sign up before buying DigiCoin.");
  if (!amount || amount < 1) throw new Error("Enter a valid DigiCoin amount.");

  const { error } = await supabase.from("orders").insert({
    profile_id: profile.id,
    item_name: `${amount} DigiCoin Top-Up`,
    item_type: "topup",
    status: "Pending",
    order_number: makeOrderNumber()
  });

  throwIfError(error, "Unable to save the top-up request.");
  return `${amount} DigiCoin top-up request saved for ${profile.username}.`;
}

export async function getOrdersForCurrentUser() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Log in to see your purchases and top-up requests.");

  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  throwIfError(error, "Unable to load orders.");
  return data || [];
}

export async function updateOwnProfile({ username, contactNumber, address }) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Please log in first.");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      username,
      contact_number: contactNumber,
      address
    })
    .eq("id", profile.id)
    .select("*")
    .single();

  throwIfError(error, "Unable to update the profile.");
  cachedProfile = normalizeProfile(data, await getSession());
  return cachedProfile;
}

export async function uploadProfileAvatar(file) {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("Please log in first.");
  if (!file) throw new Error("Profile picture is required.");

  const path = buildStoragePath(profile.id, `avatar-${Date.now()}.${fileExtension(file.name)}`);
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.profileAvatars)
    .upload(path, file, { upsert: true });

  throwIfError(uploadError, "Unable to upload the profile picture.");

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", profile.id)
    .select("*")
    .single();

  throwIfError(error, "Unable to update the profile avatar.");
  cachedProfile = normalizeProfile(data, await getSession());
  return cachedProfile;
}

async function requireAdminProfile() {
  const profile = await getCurrentProfile();
  if (!profile || !isAdminRole(profile.role)) {
    throw new Error("Admin access is required.");
  }
  return profile;
}

async function requireSuperAdminProfile() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "super_admin") {
    throw new Error("Super admin access is required.");
  }
  return profile;
}

async function requireAdminOrSuperAdminProfile() {
  const profile = await getCurrentProfile();
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) {
    throw new Error("Admin or super admin access is required.");
  }
  return profile;
}

export async function getAdminDashboardData() {
  // 1. Get current auth user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be logged in to access the admin dashboard.");
  }

  // 2. Load profile (only columns that actually exist)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, email, role, contact_number, address")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    console.error(profileError);
    throw new Error("Unable to load your profile.");
  }

  // 3. Role guard: allow BOTH admin and super_admin
  if (!isAdminRole(profile.role)) {
    throw new Error("Only admin or super admin can manage books.");
  }

  // 4. Load stats and enriched books
  const [
    { data: usersData, error: usersError },
    { data: ordersData, error: ordersError },
    { data: announcementsData, error: announcementsError },
    { data: pageViewsData, error: pageViewsError },
    { data: accountsData, error: accountsError },
    books, // enriched books with chapters from getBooks()
  ] = await Promise.all([
    supabase.from("profiles").select("id, role"),
    supabase.from("orders").select("id"),
    supabase.from("announcements").select("id, title"),
    supabase.from("page_views").select("id"),
    supabase.from("profiles").select(
      "id, username, email, role, contact_number, address"
    ),
    getBooks(), // <-- IMPORTANT: use mapped books (includes chapters[])
  ]);

  if (usersError) console.error("Error loading users", usersError);
  if (ordersError) console.error("Error loading orders", ordersError);
  if (announcementsError) console.error("Error loading announcements", announcementsError);
  if (pageViewsError) console.error("Error loading page views", pageViewsError);
  if (accountsError) console.error("Error loading accounts", accountsError);

  const users = usersData ?? [];
  const announcements = announcementsData ?? [];
  const allAccounts = accountsData ?? [];
  const pageViews = pageViewsData ?? [];
  const safeBooks = books ?? [];

  const stats = {
    users: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    superAdmins: users.filter((u) => u.role === "super_admin").length,
    orders: (ordersData ?? []).length,
    books: safeBooks.length,
    announcements: announcements.length,
    views: pageViews.length,
  };

  return {
    currentUser: {
      id: profile.id,
      username: profile.username ?? "",
      email: profile.email ?? "",
      role: profile.role ?? "user",
      authType: "password",
      contactNumber: profile.contact_number ?? "",
      address: profile.address ?? "",
    },
    stats,
    books: safeBooks,
    announcements,
    accounts: allAccounts,
  };
}

export async function saveAnnouncement(title) {
  const profile = await requireAdminOrSuperAdminProfile();
  if (!title) throw new Error("Announcement text is required.");

  const { data, error } = await supabase
    .from("announcements")
    .insert({ title, created_by: profile.id })
    .select("*")
    .single();

  throwIfError(error, "Unable to create the announcement.");
  return data;
}

export async function updateAnnouncement(id, title) {
  const profile = await requireAdminOrSuperAdminProfile();
  if (!title) throw new Error("Announcement text is required.");

  const { error } = await supabase
    .from("announcements")
    .update({ title })
    .eq("id", id)
    .eq("created_by", profile.id);

  throwIfError(error, "Unable to update the announcement.");
}

export async function deleteAnnouncement(announcementId) {
  await requireAdminOrSuperAdminProfile();

  const { error } = await supabase.from("announcements").delete().eq("id", announcementId);
  throwIfError(error, "Unable to remove the announcement.");
}

export async function saveBook({ id = "", title, genre, description, imageFile = null }) {
  const profile = await requireAdminOrSuperAdminProfile();
  if (!title || !genre || !description) {
    throw new Error("Book title, genre, and description are required.");
  }

  let bookRow;

  if (id) {
    const { data, error } = await supabase
      .from("books")
      .update({ title, genre, description })
      .eq("id", id)
      .select("*")
      .single();

    throwIfError(error, "Unable to update the book.");
    bookRow = data;
  } else {
    const { data, error } = await supabase
      .from("books")
      .insert({ title, genre, description, created_by: profile.id })
      .select("*")
      .single();

    throwIfError(error, "Unable to create the book.");
    bookRow = data;
  }

  if (imageFile) {
    const coverPath = buildStoragePath(bookRow.id, `cover-${Date.now()}.${fileExtension(imageFile.name)}`);
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.bookCovers)
      .upload(coverPath, imageFile, { upsert: true });

    throwIfError(uploadError, "Unable to upload the cover picture.");

    const { data, error } = await supabase
      .from("books")
      .update({ cover_path: coverPath })
      .eq("id", bookRow.id)
      .select("*")
      .single();

    throwIfError(error, "Unable to save the cover picture.");
    bookRow = data;
  }

  return getBookById(bookRow.id);
}

export async function getAdminBookById(bookId) {
  await requireAdminOrSuperAdminProfile();
  const book = await getBookById(bookId);
  if (!book) return null;

  return {
    ...book,
    chapters: await Promise.all(
      (book.chapters || []).map(async (chapter) => ({
        ...chapter,
        text: await downloadChapterText(chapter.filePath)
      }))
    )
  };
}

export async function saveChapter({ bookId, chapterId = "", title, text, accessType = "free" }) {
  await requireAdminOrSuperAdminProfile();
  if (!bookId) throw new Error("Select a valid book first.");
  if (!title || !text) throw new Error("Chapter title and chapter text are required.");

  const { data: currentChapters, error: chaptersError } = await supabase
    .from("chapters")
    .select("*")
    .eq("book_id", bookId)
    .order("chapter_order", { ascending: true });

  throwIfError(chaptersError, "Unable to load the chapter list.");

  const existing = (currentChapters || []).find((item) => item.id === chapterId) || null;
  const nextChapterId = chapterId || crypto.randomUUID();
  const nextOrder = existing
    ? Number(existing.chapter_order || 1)
    : (currentChapters || []).length + 1;

  const filePath = existing?.file_path || buildStoragePath(bookId, `${nextChapterId}.txt`);
  const chapterFile = createTextFile(text, `${nextChapterId}.txt`);

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.chapterFiles)
    .upload(filePath, chapterFile, { upsert: true, contentType: "text/plain;charset=utf-8" });

  throwIfError(uploadError, "Unable to upload the chapter file.");

  const payload = {
    id: nextChapterId,
    book_id: bookId,
    title,
    file_path: filePath,
    is_paid: accessType === "paid",
    chapter_order: nextOrder
  };

  const { error } = existing
    ? await supabase.from("chapters").update(payload).eq("id", nextChapterId)
    : await supabase.from("chapters").insert(payload);

  throwIfError(error, "Unable to save the chapter.");
  return getAdminBookById(bookId);
}

export async function deleteChapter(bookId, chapterId) {
  await requireAdminOrSuperAdminProfile();

  const { data, error } = await supabase.from("chapters").select("*").eq("id", chapterId).single();
  throwIfError(error, "Unable to find the chapter.");

  if (data?.file_path) {
    const { error: storageError } = await supabase.storage.from(STORAGE_BUCKETS.chapterFiles).remove([data.file_path]);
    throwIfError(storageError, "Unable to remove the chapter file.");
  }

  const { error: deleteError } = await supabase.from("chapters").delete().eq("id", chapterId);
  throwIfError(deleteError, "Unable to remove the chapter.");

  return getAdminBookById(bookId);
}

export async function deleteBook(bookId) {
  await requireAdminOrSuperAdminProfile();

  const { data: book, error: bookError } = await supabase.from("books").select("*").eq("id", bookId).single();
  throwIfError(bookError, "Unable to find the book.");

  const { data: chapters, error: chaptersError } = await supabase.from("chapters").select("file_path").eq("book_id", bookId);
  throwIfError(chaptersError, "Unable to load the chapter files.");

  const pathsToDelete = [
    ...(book?.cover_path ? [book.cover_path] : []),
    ...((chapters || []).map((item) => item.file_path).filter(Boolean))
  ];

  if (pathsToDelete.length) {
    const coverPaths = pathsToDelete.filter((path) => !path.endsWith(".txt"));
    const chapterPaths = pathsToDelete.filter((path) => path.endsWith(".txt"));

    if (coverPaths.length) {
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.bookCovers).remove(coverPaths);
      throwIfError(error, "Unable to remove the cover picture.");
    }

    if (chapterPaths.length) {
      const { error } = await supabase.storage.from(STORAGE_BUCKETS.chapterFiles).remove(chapterPaths);
      throwIfError(error, "Unable to remove the chapter files.");
    }
  }

  const { error } = await supabase.from("books").delete().eq("id", bookId);
  throwIfError(error, "Unable to remove the book.");
}

export async function updateMemberProfile({ id, username, role, contactNumber, address }) {
  await requireSuperAdminProfile();
  if (!id) throw new Error("Select a valid member first.");
  if (!username) throw new Error("Username is required.");

  const { data, error } = await supabase
    .from("profiles")
    .update({
      username,
      role,
      contact_number: contactNumber,
      address
    })
    .eq("id", id)
    .select("*")
    .single();

  throwIfError(error, "Unable to update the member profile.");
  return normalizeProfile(data, { user: { app_metadata: { provider: "password" }, email: data.email } });
}

export async function waitForSessionAfterRedirect(retries = 12) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const session = await getSession();
    if (session?.user) {
      cachedProfile = null;
      await getCurrentProfile(true);
      return session;
    }
    await delay(300);
  }
  return null;
}

// Export all functions to window.nbsShelfData for use in script.js
if (typeof window !== "undefined") {
  window.nbsShelfData = {
    getBooks,
    getAnnouncements,
    getBookById,
    getChapterAccess,
    incrementBookView,
    getCurrentUser: getCurrentProfile,
    purchaseChapter,
    toggleFavorite,
    getMyBooks,
    downloadChapterText,
    getOrdersForCurrentUser,
    updateOwnProfile,
    uploadProfileAvatar,
    getAdminDashboardData,
    saveAnnouncement,
    updateAnnouncement,
    deleteAnnouncement,
    saveBook,
    getAdminBookById,
    saveChapter,
    deleteChapter,
    deleteBook,
    updateMemberProfile,
    signInWithPassword,
    signUpWithPassword,
    signInWithOAuth,
    signOut,
    getSession,
    trackPageView,
    createTopupOrder,
    waitForSessionAfterRedirect
  };
}
