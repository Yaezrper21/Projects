// auth.js
import {
  getCurrentProfile,
  signOut,
  signUpWithPassword,
  signInWithPassword,
} from "./supabase-data.js";

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
    // Hide login/signup for authenticated users
    if (loginLink) loginLink.style.display = "none";
    if (signupLink) signupLink.style.display = "none";

    // Explicitly show profile + logout
    if (profileLink) profileLink.style.display = "inline-flex";
    if (logoutButton) logoutButton.style.display = "inline-flex";

    // Role-based admin links
    if (profile.role === "super_admin") {
      if (adminLink) adminLink.style.display = "inline-flex";
      if (superAdminLink) superAdminLink.style.display = "inline-flex";
    } else if (profile.role === "admin") {
      if (adminLink) adminLink.style.display = "inline-flex";
      if (superAdminLink) superAdminLink.style.display = "none";
    } else {
      if (adminLink) adminLink.style.display = "none";
      if (superAdminLink) superAdminLink.style.display = "none";
    }
  } else {
    // Guest mode
    if (loginLink) loginLink.style.display = "inline-flex";
    if (signupLink) signupLink.style.display = "inline-flex";
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

function initSignupForm() {
  const signupForm = document.querySelector('[data-auth-form="signup"]');
  const feedback = document.querySelector("[data-auth-feedback]");
  if (!signupForm) return;

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(signupForm);
    const username = (formData.get("username") || "").toString().trim();
    const email = (formData.get("email") || "").toString().trim();
    const contactNumber = (formData.get("contactNumber") || "").toString().trim();
    const address = (formData.get("address") || "").toString().trim();
    const password = (formData.get("password") || "").toString();
    const confirmPassword = (formData.get("confirmPassword") || "").toString();

    if (!username || !email || !password) {
      if (feedback) {
        feedback.textContent = "Username, email, and password are required.";
        feedback.dataset.state = "error";
      }
      return;
    }

    if (password !== confirmPassword) {
      if (feedback) {
        feedback.textContent = "Passwords do not match.";
        feedback.dataset.state = "error";
      }
      return;
    }

    try {
      if (feedback) {
        feedback.textContent = "Creating your account...";
        feedback.dataset.state = "info";
      }

      await signUpWithPassword({ username, email, password, contactNumber, address });

      // Auto-login after signup
      await signInWithPassword(email, password);

      if (feedback) {
        feedback.textContent = "Account created. Redirecting...";
        feedback.dataset.state = "success";
      }

      window.location.href = "index.html";
    } catch (error) {
      console.error("Sign up failed", error);
      if (feedback) {
        feedback.textContent = error.message || "Unable to create the account.";
        feedback.dataset.state = "error";
      }
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  void initAuthUi();
  initSignupForm();
});
