import {
  getCurrentUser,
  updateOwnProfile,
  uploadProfileAvatar,
} from "./supabase-data.js";

document.addEventListener("DOMContentLoaded", () => {
  void initProfilePage();
});

async function initProfilePage() {
  const feedbackEl = document.querySelector("[data-profile-feedback]");
  const avatarImg = document.querySelector("[data-profile-avatar]");
  const form = document.querySelector("[data-profile-form]");
  const avatarForm = document.querySelector("[data-profile-avatar-form]");

  function setFeedback(msg, state = "info") {
    if (!feedbackEl) return;
    feedbackEl.textContent = msg;
    feedbackEl.dataset.state = state;
  }

  try {
    setFeedback("Loading profile...", "info");
    const profile = await getCurrentUser(true); // force refresh from DB
    if (!profile) {
      setFeedback("Please log in to view your profile.", "error");
      return;
    }

    // Fill fields
    document.querySelector("[data-profile-username]").value =
      profile.username || "";
    document.querySelector("[data-profile-email]").value =
      profile.email || "";
    document.querySelector("[data-profile-contact]").value =
      profile.contactNumber || "";
    document.querySelector("[data-profile-address]").value =
      profile.address || "";

    // Show avatar if exists
    if (profile.avatarUrl && avatarImg) {
      avatarImg.src = profile.avatarUrl;
    }

    setFeedback("Profile loaded.", "success");
  } catch (err) {
    console.error(err);
    setFeedback(err.message || "Unable to load profile.", "error");
  }

  // Save text fields
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const username =
        document.querySelector("[data-profile-username]").value.trim();
      const contactNumber =
        document.querySelector("[data-profile-contact]").value.trim();
      const address =
        document.querySelector("[data-profile-address]").value.trim();

      try {
        setFeedback("Saving profile...", "info");
        const updated = await updateOwnProfile({
          username,
          contactNumber,
          address,
        });
        if (updated.avatarUrl && avatarImg) {
          avatarImg.src = updated.avatarUrl;
        }
        setFeedback("Profile saved.", "success");
      } catch (err) {
        console.error(err);
        setFeedback(err.message || "Unable to save profile.", "error");
      }
    });
  }

  // Upload avatar
  if (avatarForm) {
    avatarForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const fileInput = avatarForm.querySelector('input[name="avatar"]');
      const file = fileInput?.files?.[0];

      if (!file) {
        setFeedback("Please choose an image file.", "error");
        return;
      }

      try {
        setFeedback("Uploading avatar...", "info");
        const updated = await uploadProfileAvatar(file);
        if (updated.avatarUrl && avatarImg) {
          avatarImg.src = updated.avatarUrl;
        }
        setFeedback("Avatar updated.", "success");
      } catch (err) {
        console.error(err);
        setFeedback(err.message || "Unable to upload avatar.", "error");
      }
    });
  }
}
