// Global Supabase Auth Manager (replaces auth.js)
// Add to ALL HTMLs after supabase-data.js

document.addEventListener('DOMContentLoaded', async () => {
  const page = document.body.dataset.page || '';
  
  // Session banner + nav
  const sessionBanner = document.querySelector('[data-session-banner]');
  const profileSpans = document.querySelectorAll('[data-profile]');
  
  async function renderSession(currentProfile) {
    if (sessionBanner) {
      if (!currentProfile) {
        sessionBanner.innerHTML = '<strong>Guest</strong><span>Login for purchases.</span>';
      } else {
        const role = currentProfile.role === 'super_admin' ? 'Super Admin' : currentProfile.role;
        sessionBanner.innerHTML = `<strong>${currentProfile.username}</strong><span>${role} (${currentProfile.authType}).</span>`;
      }
    }

    
    if (profileSpans.length && currentProfile) {
      profileSpans.forEach(span => {
        if (span.dataset.profile === 'username') span.textContent = currentProfile.username;
        if (span.dataset.profile === 'email') span.textContent = currentProfile.email;
        if (span.dataset.profile === 'role') span.textContent = currentProfile.role?.replace('_', ' ') || 'user';
        if (span.dataset.profile === 'auth') span.textContent = currentProfile.authType || 'password';
        if (span.dataset.profile === 'contact') span.textContent = currentProfile.contactNumber || 'Not set';
        if (span.dataset.profile === 'address') span.textContent = currentProfile.address || 'Not set';
        if (span.dataset.profile === 'initials') span.textContent = currentProfile.username ? buildInitials(currentProfile.username) : 'NB';
      });
    }
    
    // Logout buttons
    document.querySelectorAll('[data-action=\"logout\"]').forEach(btn => {
      btn.addEventListener('click', () => window.nbsShelfData.signOut().then(() => location.reload()));
    });
    
    // Protected pages
    if (page === 'profile' && !currentProfile) window.location.href = 'login.html?redirect=profile';
    if ((page === 'admin' || page === 'edit-book') && (!currentProfile || !['admin', 'super_admin'].includes(currentProfile.role))) {
      window.location.href = 'login.html?message=Admin required';
    }
    // Admin nav everywhere
    const nav = document.querySelector('.main-nav');
    if (nav && currentProfile && ['admin', 'super_admin'].includes(currentProfile.role)) {
      let adminLink = nav.querySelector('a[href="admin.html"]');
      if (!adminLink) {
        adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.className = 'nav-link';
        adminLink.textContent = 'Admin';
        nav.appendChild(adminLink);
      }
      if (window.location.pathname.includes('admin.html')) adminLink.classList.add('active');
    }

  }
  
  const profile = await window.nbsShelfData.getCurrentProfile();
  renderSession(profile);
  
  // Login form
  const loginForm = document.querySelector('[data-auth-form=\"login\"]');
  if (loginForm) {
    const feedback = document.querySelector('[data-auth-feedback]');
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      try {
        const result = await window.nbsShelfData.signInWithPassword(formData.get('email'), formData.get('password'));
        if (feedback) feedback.textContent = 'Logged in!';
        setTimeout(() => location.href = 'index.html', 800);
      } catch (err) {
        if (feedback) feedback.textContent = err.message || 'Login failed';
      }
    });
    
    // Social (demo)
    document.querySelectorAll('[data-social]').forEach(btn => {
      btn.addEventListener('click', () => {
        const provider = btn.dataset.social.toLowerCase();
        window.nbsShelfData.signInWithOAuth(provider);
      });
    });
  }
  
  // Signup form
  const signupForm = document.querySelector('[data-auth-form=\"signup\"]');
  if (signupForm) {
    const feedback = document.querySelector('[data-auth-feedback]');
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(signupForm);
      try {
        await window.nbsShelfData.signUpWithPassword({
          username: formData.get('username'),
          email: formData.get('email'),
          password: formData.get('password'),
          contactNumber: formData.get('contactNumber'),
          address: formData.get('address')
        });
        if (feedback) feedback.textContent = 'Signed up! Redirecting...';
        setTimeout(() => location.href = 'index.html', 1200);
      } catch (err) {
        if (feedback) feedback.textContent = err.message || 'Signup failed';
      }
    });
  }
  
  function buildInitials(str) {
    return str.split(' ').slice(0,2).map(s => s[0]?.toUpperCase() || '').join('') || 'NB';
  }
});

