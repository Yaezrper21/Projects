import {
  getCurrentProfile,
  updateProfileDetails,
  updateProfileAvatar,
} from "./supabase-data.js";

document.addEventListener("DOMContentLoaded", () => {
  void initProfilePage();
});

async function initProfilePage() {
  const feedback = document.querySelector("[data-profile-feedback]");
  const form = document.querySelector("[data-profile-form]");
  const avatarForm = document.querySelector("[data-profile-avatar-form]");
  const avatarImg = document.querySelector("[data-profile-avatar]");
  const avatarFallback = document.querySelector("[data-profile-avatar-fallback]");

  function setFeedback(message, state = "info") {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.dataset.state = state;
  }

  try {
    setFeedback("Loading profile...", "info");
    const profile = await getCurrentProfile();
    if (!profile) {
      setFeedback("You must be logged in to view your profile.", "error");
      return;
    }

    // Prefill fields
    if (form) {
      form.username.value = profile.username || "";
      form.email.value = profile.email || "";
      form.contactNumber.value = profile.contactNumber || "";
      form.address.value = profile.address || "";
    }

    // Avatar display
    updateAvatarUi(profile, avatarImg, avatarFallback);
    setFeedback("Profile loaded.", "success");
  } catch (error) {
    console.error(error);
    setFeedback(error.message || "Unable to load profile.", "error");
  }

  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(form);

      const payload = {
        username: formData.get("username")?.toString().trim() || "",
        contactNumber: formData.get("contactNumber")?.toString().trim() || "",
        address: formData.get("address")?.toString().trim() || "",
      };

      try {
        setFeedback("Saving changes...", "info");
        const updated = await updateProfileDetails(payload);
        updateAvatarUi(updated, avatarImg, avatarFallback);
        setFeedback("Profile updated.", "success");
      } catch (error) {
        console.error(error);
        setFeedback(error.message || "Unable to save profile.", "error");
      }
    });
  }

  if (avatarForm) {
    avatarForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(avatarForm);
      const file = formData.get("avatar");

      try {
        setFeedback("Uploading avatar...", "info");
        const updated = await updateProfileAvatar(file);
        updateAvatarUi(updated, avatarImg, avatarFallback);
        setFeedback("Avatar updated.", "success");
      } catch (error) {
        console.error(error);
        setFeedback(error.message || "Unable to update avatar.", "error");
      }
    });
  }
}

function updateAvatarUi(profile, imgEl, fallbackEl) {
  if (!imgEl || !fallbackEl) return;

  if (profile.avatarUrl) {
    imgEl.src = profile.avatarUrl;
    imgEl.hidden = false;
    fallbackEl.hidden = true;
  } else {
    imgEl.hidden = true;
    fallbackEl.hidden = false;
    const initials = (profile.username || profile.email || "NB")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() || "")
      .join("") || "NB";
    fallbackEl.textContent = initials;
  }
}
