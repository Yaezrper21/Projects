// auth.js
import { getCurrentProfile, signOut } from "./supabase-data.js";

async function initAuthUi() {
  const loginLink = document.querySelector('a[href="login.html"]');
  const signupLink = document.querySelector('a[href="signup.html"]');
  const profileLink = document.querySelector('a[href="profile.html"]');
  const adminLink = document.querySelector('a[href="admin.html"]');
  const superAdminLink = document.querySelector('a[href="super-admin.html"]');
  const logoutButton = document.querySelector("[data-logout]"); // profile/logout buttons

  try {
    const profile = await getCurrentProfile();

    if (!profile) {
      // Guest
      if (loginLink) loginLink.style.display = "";
      if (signupLink) signupLink.style.display = "";
      if (profileLink) profileLink.style.display = "none";
      if (adminLink) adminLink.style.display = "none";
      if (superAdminLink) superAdminLink.style.display = "none";
      if (logoutButton) logoutButton.style.display = "none";
      return;
    }

    // Logged in
    if (loginLink) loginLink.style.display = "none";
    if (signupLink) signupLink.style.display = "none";
    if (profileLink) profileLink.style.display = "";
    if (logoutButton) logoutButton.style.display = "";

    // Role-based
    if (profile.role === "super_admin") {
      if (superAdminLink) superAdminLink.style.display = "";
      if (adminLink) adminLink.style.display = "";
    } else if (profile.role === "admin") {
      if (adminLink) adminLink.style.display = "";
      if (superAdminLink) superAdminLink.style.display = "none";
    } else {
      if (adminLink) adminLink.style.display = "none";
      if (superAdminLink) superAdminLink.style.display = "none";
    }
  } catch (error) {
    console.error("Failed to init auth UI", error);
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await signOut();
        window.location.href = "index.html";
      } catch (error) {
        console.error("Failed to sign out", error);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void initAuthUi();
});
