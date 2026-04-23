const libraryButtons = document.querySelectorAll("[data-library-tab]");
const libraryViews = document.querySelectorAll(".library-view");

const shelves = {
  popular: [
    ["Study Sprint", "Reviewer Bundle"],
    ["Komiks Nights", "Graphic Stories"],
    ["Campus Crush", "Young Adult"],
    ["Math Made Easy", "Education"],
    ["Creative Lettering", "Arts & Crafts"]
  ],
  trending: [
    ["Pinoy Horror Files", "Drama"],
    ["Pocket Science", "Reference"],
    ["Sketch Daily", "Creative"],
    ["World Atlas Lite", "Learning"],
    ["After Class", "Fiction"]
  ],
  latest: [
    ["New Wave Manga", "Comics"],
    ["STEM Notes", "Academic"],
    ["Poetry Room", "Literature"],
    ["Quick Finance", "Business"],
    ["History Reframed", "Nonfiction"],
    ["Junior Readers", "Kids"],
    ["Campus Planner", "Lifestyle"],
    ["Filipino Short Reads", "Local"],
    ["Theater Scripts", "Drama"],
    ["Code Basics", "Technology"]
  ],
  action: [
    ["Zero Hour", "Action"],
    ["Metro Run", "Action"],
    ["Night Signal", "Action"],
    ["Last Train", "Action"],
    ["Cipher Club", "Action"]
  ],
  comedy: [
    ["Laugh Track", "Comedy"],
    ["Dorm Life", "Comedy"],
    ["Snack Break", "Comedy"],
    ["Office Antics", "Comedy"],
    ["Comic Relief", "Comedy"]
  ],
  drama: [
    ["Letters Home", "Drama"],
    ["Second Semester", "Drama"],
    ["Quiet Room", "Drama"],
    ["Once Again", "Drama"],
    ["Late Afternoon", "Drama"]
  ],
  horror: [
    ["Blackout", "Horror"],
    ["Third Floor", "Horror"],
    ["Red Diary", "Horror"],
    ["Night Shift", "Horror"],
    ["Static", "Horror"]
  ]
};

function createBookCard([title, subtitle]) {
  const card = document.createElement("article");
  card.className = "book-card";
  card.innerHTML = `
    <div class="book-cover"></div>
    <div class="book-meta">
      <p class="book-title">${title}</p>
      <p class="book-subtitle">${subtitle}</p>
    </div>
  `;
  return card;
}

function fillShelf(id, items, copies = items.length) {
  const container = document.getElementById(id);
  if (!container) return;

  const repeated = Array.from({ length: copies }, (_, index) => items[index % items.length]);
  repeated.forEach((item) => container.appendChild(createBookCard(item)));
}

fillShelf("home-popular", shelves.popular);
fillShelf("home-trending", shelves.trending);
fillShelf("home-latest", shelves.latest);
fillShelf("genre-action", shelves.action);
fillShelf("genre-comedy", shelves.comedy);
fillShelf("genre-drama", shelves.drama);
fillShelf("genre-horror", shelves.horror);
fillShelf("library-popular-grid", shelves.popular, 30);
fillShelf("library-trending-grid", shelves.trending, 30);
fillShelf("library-latest-grid", shelves.latest, 30);

function setLibraryTab(tabId) {
  libraryViews.forEach((view) => view.classList.toggle("active", view.id === `library-${tabId}`));
  libraryButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.libraryTab === tabId);
  });
}

libraryButtons.forEach((button) => {
  button.addEventListener("click", () => setLibraryTab(button.dataset.libraryTab));
});
