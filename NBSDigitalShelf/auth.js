// auth.js
import { getCurrentProfile, signOut } from "./supabase-data.js";

async function initAuthUi() {
  let profile = null;

  try {
    profile = await getCurrentProfile();
  } catch (error) {
    console.error("Unable to load profile for auth UI", error);
  }

  const loginLink = document.querySelector('a[href="login.html"]');
  const signupLink = document.querySelector('a[href="signup.html"]');
  const profileLink = document.querySelector('a[href="profile.html"]');
  const adminLink = document.querySelector('a[href="admin.html"]');
  const superAdminLink = document.querySelector('a[href="super-admin.html"]');
  const logoutButton = document.querySelector("[data-logout]");

  if (profile) {
    if (loginLink) loginLink.style.display = "none";
    if (signupLink) signupLink.style.display = "none";
    if (profileLink) profileLink.style.display = "";
    if (logoutButton) logoutButton.style.display = "";

    if (profile.role === "super_admin") {
      if (adminLink) adminLink.style.display = "none";
      if (superAdminLink) superAdminLink.style.display = "";
    } else if (profile.role === "admin") {
      if (adminLink) adminLink.style.display = "";
      if (superAdminLink) superAdminLink.style.display = "none";
    } else {
      if (adminLink) adminLink.style.display = "none";
      if (superAdminLink) superAdminLink.style.display = "none";
    }
  } else {
    if (loginLink) loginLink.style.display = "";
    if (signupLink) signupLink.style.display = "";
    if (profileLink) profileLink.style.display = "none";
    if (logoutButton) logoutButton.style.display = "none";
    if (adminLink) adminLink.style.display = "none";
    if (superAdminLink) superAdminLink.style.display = "none";
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await signOut();
        window.location.href = "index.html";
      } catch (error) {
        console.error("Unable to log out.", error);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void initAuthUi();
});
