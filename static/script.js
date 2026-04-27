console.log("SCRIPT.JS LOADED");

const REGISTER_URL = "/register";
const LOGIN_URL = "/login";

// ---------- Feed state ----------
let feedOffset = 0;
let feedLimit = 10;
let isLoadingFeed = false;
let hasMoreFeedPosts = true;

// ---------- Page setup ----------
window.onload = async () => {
    applySavedTheme();

    setupRegisterForm();
    setupLoginForm();

    await setupHomePage();
    await setupCaloriePage();
    await setupAdminPage();
    await setupCreatePostPage();
    await setupFeedPage();
    await setupProfilePage();
    await setupSettingsPage();
};

// ---------- Auth helpers ----------
function getCurrentUser() {
    const userData = localStorage.getItem("nutriUser");
    return userData ? JSON.parse(userData) : null;
}

function getToken() {
    return localStorage.getItem("nutriToken");
}

function getAuthHeaders(includeJson = true) {
    const token = getToken();
    const headers = {};

    if (includeJson) {
        headers["Content-Type"] = "application/json";
    }

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
}

function logoutUser() {
    localStorage.removeItem("nutriUser");
    localStorage.removeItem("nutriToken");
    window.location.href = "/login";
}

async function fetchCurrentUserFromToken() {
    const token = getToken();
    if (!token) return null;

    try {
        const response = await fetch("/me", {
            headers: getAuthHeaders(false)
        });

        if (!response.ok) return null;

        const user = await response.json();
        localStorage.setItem("nutriUser", JSON.stringify(user));
        return user;
    } catch (error) {
        console.error("Error fetching current user:", error);
        return null;
    }
}

// ---------- Theme helpers ----------
function applySavedTheme() {
    const savedTheme = localStorage.getItem("nutriTheme") || "light";
    document.body.classList.toggle("dark-mode", savedTheme === "dark");

    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
}

function setTheme(theme) {
    const finalTheme = theme === "dark" ? "dark" : "light";
    localStorage.setItem("nutriTheme", finalTheme);
    document.body.classList.toggle("dark-mode", finalTheme === "dark");
}

// ---------- Register ----------
function setupRegisterForm() {
    const registerForm = document.getElementById("register-form");
    if (!registerForm) return;

    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const usernameInput = document.getElementById("register-username");
        const emailInput = document.getElementById("register-email");
        const passwordInput = document.getElementById("register-password");
        const message = document.getElementById("register-message");

        if (!usernameInput || !emailInput || !passwordInput || !message) return;

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        try {
            const response = await fetch(REGISTER_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                message.textContent = "Registration successful. Redirecting to login...";
                message.style.color = "green";

                setTimeout(() => {
                    window.location.href = "/login";
                }, 1200);
            } else {
                message.textContent = data.detail || "Registration failed.";
                message.style.color = "red";
            }
        } catch (error) {
            console.error("Registration error:", error);
            message.textContent = "Something went wrong during registration.";
            message.style.color = "red";
        }
    });
}

// ---------- Login ----------
function setupLoginForm() {
    const loginForm = document.getElementById("login-form");
    if (!loginForm) return;

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const emailInput = document.getElementById("login-email");
        const passwordInput = document.getElementById("login-password");
        const message = document.getElementById("login-message");

        if (!emailInput || !passwordInput || !message) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        try {
            const response = await fetch(LOGIN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("nutriUser", JSON.stringify(data.user));
                localStorage.setItem("nutriToken", data.access_token);

                message.textContent = "Login successful. Redirecting...";
                message.style.color = "green";

                setTimeout(() => {
                    window.location.href = "/home";
                }, 1000);
            } else {
                message.textContent = data.detail || "Login failed.";
                message.style.color = "red";
            }
        } catch (error) {
            console.error("Login error:", error);
            message.textContent = "Something went wrong during login.";
            message.style.color = "red";
        }
    });
}

// ---------- Shared header ----------
function renderUserHeader(user) {
    const userBar = document.getElementById("user-bar");
    const adminTab = document.getElementById("admin-tab");

    if (!userBar || !user) return;

    if (adminTab) {
        adminTab.style.display = user.role === "admin" ? "inline-flex" : "none";
    }

    userBar.innerHTML = `
        <div>
            Logged in as <strong>${escapeHtml(user.username)}</strong>
        </div>
        <div class="user-bar-right">
            <span class="user-role-pill">${escapeHtml(user.role)}</span>
            <a href="/settings" class="settings-gear" title="Settings">⚙️</a>
            <button onclick="logoutUser()">Logout</button>
        </div>
    `;
}

// ---------- Home page ----------
async function setupHomePage() {
    const usernameEl = document.getElementById("home-username");
    const consumedEl = document.getElementById("home-calories-consumed");
    const burnedEl = document.getElementById("home-calories-burned");
    const userSinceEl = document.getElementById("home-user-since");
    const netEl = document.getElementById("home-net-calories");
    
    if (!usernameEl || !consumedEl || !burnedEl || !netEl || !userSinceEl) return;

    const token = getToken();
    if (!token) {
        window.location.href = "/login";
        return;
    }

    const currentUser = await fetchCurrentUserFromToken();
    if (!currentUser) {
        logoutUser();
        return;
    }

    renderUserHeader(currentUser);
    usernameEl.textContent = currentUser.username;

    if (currentUser.created_at) {
        const date = new Date(currentUser.created_at);
        userSinceEl.textContent = `User Since ${date.toLocaleDateString()}`;
    } else {
        userSinceEl.textContent = "User Since --";
    }

    await loadHomeTodayStats();
}

async function loadHomeTodayStats() {
    const consumedEl = document.getElementById("home-calories-consumed");
    const burnedEl = document.getElementById("home-calories-burned");
    const netEl = document.getElementById("home-net-calories");

    if (!consumedEl || !burnedEl || !netEl) return;

    try {
        const response = await fetch("/home/today-stats", {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();

        consumedEl.textContent = data.calories_consumed_today ?? 0;
        burnedEl.textContent = data.calories_burned_today ?? 0;
        netEl.textContent = data.net_calories_today ?? 0;
    } catch (error) {
        console.error("Error loading home today stats:", error);
        consumedEl.textContent = "0";
        burnedEl.textContent = "0";
        netEl.textContent = "0";
    }
}

// ---------- Tracker page ----------
let trackerSelectedDate = startOfLocalDay(new Date());

function startOfLocalDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function formatTrackerDateForApi(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function renderTrackerDateLabel() {
    const labelEl = document.getElementById("tracker-date-display");
    if (!labelEl) return;

    const today = startOfLocalDay(new Date());
    const diffDays = Math.round((trackerSelectedDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        labelEl.textContent = "Today";
    } else if (diffDays === -1) {
        labelEl.textContent = "Yesterday";
    } else if (diffDays === 1) {
        labelEl.textContent = "Tomorrow";
    } else {
        labelEl.textContent = trackerSelectedDate.toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
        });
    }
}

function changeTrackerDate(deltaDays) {
    const next = new Date(trackerSelectedDate);
    next.setDate(next.getDate() + deltaDays);
    trackerSelectedDate = next;
    renderTrackerDateLabel();
    loadFoodLogs();
    loadExerciseLogs();
}

async function setupCaloriePage() {
    const calorieList = document.getElementById("calorie-list");
    const totalDisplay = document.getElementById("total-calories");

    if (!calorieList || !totalDisplay) return;

    const token = getToken();
    if (!token) {
        window.location.href = "/login";
        return;
    }

    const currentUser = await fetchCurrentUserFromToken();
    if (!currentUser) {
        logoutUser();
        return;
    }

    renderUserHeader(currentUser);
    trackerSelectedDate = startOfLocalDay(new Date());
    renderTrackerDateLabel();
    loadFoodLogs();
    loadExerciseLogs();
}

// ---------- Food section ----------
let foodList = [];
let selectedFood = null;
let foodCaloriesTotal = 0;
let exerciseCaloriesTotal = 0;

function updateCalorieTotals() {
    const inEl = document.getElementById("calories-in");
    const outEl = document.getElementById("calories-out");
    const totalEl = document.getElementById("total-calories");

    if (inEl) inEl.textContent = foodCaloriesTotal;
    if (outEl) outEl.textContent = exerciseCaloriesTotal;
    if (totalEl) totalEl.textContent = foodCaloriesTotal - exerciseCaloriesTotal;
}

async function loadFoodLogs() {
    try {
        const dateParam = formatTrackerDateForApi(trackerSelectedDate);
        const response = await fetch(`/food-logs?date=${dateParam}`, {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();
        renderFoodList(data);
    } catch (error) {
        console.error("Error fetching food logs:", error);
    }
}

function renderFoodList(logs) {
    const listElement = document.getElementById("calorie-list");
    const emptyLabel = document.getElementById("food-empty");

    if (!listElement || !emptyLabel) return;

    listElement.innerHTML = "";
    let total = 0;

    if (logs.length === 0) {
        emptyLabel.style.display = "block";
    } else {
        emptyLabel.style.display = "none";
    }

    logs.forEach(log => {
        total += log.calories;

        const li = document.createElement("li");
        li.className = "item food-item";

        const itemInfo = document.createElement("div");
        itemInfo.className = "item-info";

        const strong = document.createElement("strong");
        strong.textContent = log.food_name;
        itemInfo.appendChild(strong);
        itemInfo.append(` - ${log.calories} kcal`);

        li.appendChild(itemInfo);

        const actions = document.createElement("div");
        actions.className = "actions";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn food-delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => openDeleteFoodModal(log.id);
        actions.appendChild(deleteBtn);

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "Edit";
        editBtn.onclick = () => openEditFoodModal(log);
        actions.appendChild(editBtn);

        li.appendChild(actions);

        listElement.appendChild(li);
    });

    foodCaloriesTotal = total;
    updateCalorieTotals();
}

async function openAddFoodModal() {
    const modal = document.getElementById("add-food-modal");
    if (modal) {
        modal.style.display = "block";
    }

    try {
        const response = await fetch("/foods", {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            foodList = await response.json();
        }
    } catch (error) {
        console.error("Error fetching foods:", error);
    }

    const searchInput = document.getElementById("food-search");
    if (searchInput) {
        searchInput.focus();
        searchInput.oninput = () => filterFoodSearch(searchInput.value);
    }
}

function filterFoodSearch(query) {
    const resultsEl = document.getElementById("food-results");
    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    selectedFood = null;

    if (!query.trim()) {
        resultsEl.style.display = "none";
        return;
    }

    const lower = query.toLowerCase();
    const matches = foodList.filter(f => f.name.toLowerCase().includes(lower));

    if (matches.length === 0) {
        resultsEl.style.display = "none";
        return;
    }

    matches.forEach(f => {
        const li = document.createElement("li");
        li.textContent = f.name;
        li.onclick = () => {
            const foodSearch = document.getElementById("food-search");
            if (foodSearch) {
                foodSearch.value = f.name;
            }
            selectedFood = f;
            resultsEl.innerHTML = "";
            resultsEl.style.display = "none";
        };
        resultsEl.appendChild(li);
    });

    resultsEl.style.display = "block";
}

function closeAddFoodModal() {
    const modal = document.getElementById("add-food-modal");
    if (modal) {
        modal.style.display = "none";
    }

    const foodSearch = document.getElementById("food-search");
    const foodGrams = document.getElementById("food-grams");
    const foodError = document.getElementById("food-error");
    const foodResults = document.getElementById("food-results");

    if (foodSearch) foodSearch.value = "";
    if (foodGrams) foodGrams.value = "";
    if (foodError) foodError.style.display = "none";
    if (foodResults) {
        foodResults.innerHTML = "";
        foodResults.style.display = "none";
    }

    foodList = [];
    selectedFood = null;
}

async function addFoodEntry() {
    const gramsInput = document.getElementById("food-grams")?.value.trim() || "";
    const errorEl = document.getElementById("food-error");

    if (!errorEl) return;
    errorEl.style.display = "none";

    if (!selectedFood) {
        errorEl.textContent = "Please select a food from the list.";
        errorEl.style.display = "block";
        return;
    }

    if (!gramsInput) {
        errorEl.textContent = "Please enter the amount in grams.";
        errorEl.style.display = "block";
        return;
    }

    const grams = parseFloat(gramsInput);

    if (isNaN(grams) || grams <= 0) {
        errorEl.textContent = "Grams must be a positive number.";
        errorEl.style.display = "block";
        return;
    }

    const decimalParts = gramsInput.split(".");
    if (decimalParts.length === 2 && decimalParts[1].length > 2) {
        errorEl.textContent = "Grams can have at most 2 decimal places (e.g. 0.25).";
        errorEl.style.display = "block";
        return;
    }

    const calories = Math.round((selectedFood.calories / selectedFood.serving_size_g) * grams);

    try {
        const response = await fetch("/food-logs", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                food_name: selectedFood.name,
                calories: calories,
                grams: grams
            })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            closeAddFoodModal();
            loadFoodLogs();
        } else {
            const data = await response.json();
            errorEl.textContent = data.detail || "Failed to log food.";
            errorEl.style.display = "block";
        }
    } catch (error) {
        console.error("Error logging food:", error);
        errorEl.textContent = "Something went wrong.";
        errorEl.style.display = "block";
    }
}

let foodLogToDelete = null;

function openDeleteFoodModal(logId) {
    foodLogToDelete = logId;
    document.getElementById("delete-food-modal").style.display = "block";
}

function closeDeleteFoodModal() {
    foodLogToDelete = null;
    document.getElementById("delete-food-modal").style.display = "none";
}

async function confirmDeleteFood() {
    if (!foodLogToDelete) {
        closeDeleteFoodModal();
        return;
    }

    try {
        const response = await fetch(`/food-logs/${foodLogToDelete}`, {
            method: "DELETE",
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            closeDeleteFoodModal();
            loadFoodLogs();
        } else {
            const data = await response.json().catch(() => ({}));
            alert(data.detail || "Failed to delete food log.");
            closeDeleteFoodModal();
        }
    } catch (error) {
        console.error("Error deleting food log:", error);
        alert("Something went wrong.");
        closeDeleteFoodModal();
    }
}

// ---------- Edit Food ----------
let foodLogToEdit = null;
let selectedEditFood = null;
let editFoodList = [];

async function openEditFoodModal(log) {
    foodLogToEdit = log;

    const modal = document.getElementById("edit-food-modal");
    const searchInput = document.getElementById("edit-food-search");
    const gramsInput = document.getElementById("edit-food-grams");
    const errorEl = document.getElementById("edit-food-error");
    const resultsEl = document.getElementById("edit-food-results");

    if (!modal || !searchInput || !gramsInput) return;

    if (errorEl) errorEl.style.display = "none";
    if (resultsEl) {
        resultsEl.innerHTML = "";
        resultsEl.style.display = "none";
    }

    modal.style.display = "block";

    try {
        const response = await fetch("/foods", { headers: getAuthHeaders(false) });
        if (response.status === 401) { logoutUser(); return; }
        if (response.ok) editFoodList = await response.json();
    } catch (error) {
        console.error("Error fetching foods:", error);
    }

    selectedEditFood = editFoodList.find(f => f.name === log.food_name) || null;
    searchInput.value = log.food_name;
    searchInput.oninput = () => filterEditFoodSearch(searchInput.value);

    if (log.grams != null) {
        gramsInput.value = log.grams;
    } else if (selectedEditFood) {
        const derived = (log.calories * selectedEditFood.serving_size_g) / selectedEditFood.calories;
        gramsInput.value = derived.toFixed(2);
    } else {
        gramsInput.value = "";
    }
}

function filterEditFoodSearch(query) {
    const resultsEl = document.getElementById("edit-food-results");
    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    selectedEditFood = null;

    if (!query.trim()) {
        resultsEl.style.display = "none";
        return;
    }

    const lower = query.toLowerCase();
    const matches = editFoodList.filter(f => f.name.toLowerCase().includes(lower));

    if (matches.length === 0) {
        resultsEl.style.display = "none";
        return;
    }

    matches.forEach(f => {
        const li = document.createElement("li");
        li.textContent = f.name;
        li.onclick = () => {
            const searchInput = document.getElementById("edit-food-search");
            if (searchInput) searchInput.value = f.name;
            selectedEditFood = f;
            resultsEl.innerHTML = "";
            resultsEl.style.display = "none";
        };
        resultsEl.appendChild(li);
    });

    resultsEl.style.display = "block";
}

function closeEditFoodModal() {
    const modal = document.getElementById("edit-food-modal");
    if (modal) modal.style.display = "none";

    const searchInput = document.getElementById("edit-food-search");
    const gramsInput = document.getElementById("edit-food-grams");
    const errorEl = document.getElementById("edit-food-error");
    const resultsEl = document.getElementById("edit-food-results");

    if (searchInput) searchInput.value = "";
    if (gramsInput) gramsInput.value = "";
    if (errorEl) errorEl.style.display = "none";
    if (resultsEl) {
        resultsEl.innerHTML = "";
        resultsEl.style.display = "none";
    }

    foodLogToEdit = null;
    selectedEditFood = null;
    editFoodList = [];
}

async function saveFoodEdit() {
    const errorEl = document.getElementById("edit-food-error");
    const gramsInput = document.getElementById("edit-food-grams");

    if (!errorEl || !gramsInput || !foodLogToEdit) return;
    errorEl.style.display = "none";

    if (!selectedEditFood) {
        errorEl.textContent = "Please select a food from the list.";
        errorEl.style.display = "block";
        return;
    }

    const gramsRaw = gramsInput.value.trim();
    if (!gramsRaw) {
        errorEl.textContent = "Please enter the amount in grams.";
        errorEl.style.display = "block";
        return;
    }

    const grams = parseFloat(gramsRaw);
    if (isNaN(grams) || grams <= 0) {
        errorEl.textContent = "Grams must be a positive number.";
        errorEl.style.display = "block";
        return;
    }

    const decimalParts = gramsRaw.split(".");
    if (decimalParts.length === 2 && decimalParts[1].length > 2) {
        errorEl.textContent = "Grams can have at most 2 decimal places (e.g. 0.25).";
        errorEl.style.display = "block";
        return;
    }

    const calories = Math.round((selectedEditFood.calories / selectedEditFood.serving_size_g) * grams);

    try {
        const response = await fetch(`/food-logs/${foodLogToEdit.id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                food_name: selectedEditFood.name,
                calories: calories,
                grams: grams
            })
        });

        if (response.status === 401) { logoutUser(); return; }

        if (response.ok) {
            closeEditFoodModal();
            loadFoodLogs();
        } else {
            const data = await response.json().catch(() => ({}));
            errorEl.textContent = data.detail || "Failed to update food log.";
            errorEl.style.display = "block";
        }
    } catch (error) {
        console.error("Error updating food log:", error);
        errorEl.textContent = "Something went wrong.";
        errorEl.style.display = "block";
    }
}

// ---------- Exercise section ----------
let exerciseList = [];
let selectedExercise = null;

async function loadExerciseLogs() {
    try {
        const dateParam = formatTrackerDateForApi(trackerSelectedDate);
        const response = await fetch(`/exercise-logs?date=${dateParam}`, {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();
        renderExerciseList(data);
    } catch (error) {
        console.error("Error fetching exercise logs:", error);
    }
}

function renderExerciseList(logs) {
    const listElement = document.getElementById("exercise-list");
    const emptyLabel = document.getElementById("exercise-empty");
    if (!listElement || !emptyLabel) return;

    listElement.innerHTML = "";
    let total = 0;

    if (logs.length === 0) {
        emptyLabel.style.display = "block";
    } else {
        emptyLabel.style.display = "none";
    }

    logs.forEach(log => {
        total += log.calories_burned;

        const li = document.createElement("li");
        li.className = "item exercise-item";

        const itemInfo = document.createElement("div");
        itemInfo.className = "item-info";
        const strong = document.createElement("strong");
        strong.textContent = log.exercise_name;
        itemInfo.appendChild(strong);
        itemInfo.append(` - ${log.calories_burned} kcal burned`);

        li.appendChild(itemInfo);

        const actions = document.createElement("div");
        actions.className = "actions";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn exercise-delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => openDeleteExerciseModal(log.id);
        actions.appendChild(deleteBtn);

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "Edit";
        editBtn.onclick = () => openEditExerciseModal(log);
        actions.appendChild(editBtn);

        li.appendChild(actions);

        listElement.appendChild(li);
    });

    exerciseCaloriesTotal = total;
    updateCalorieTotals();
}

let exerciseLogToDelete = null;

function openDeleteExerciseModal(logId) {
    exerciseLogToDelete = logId;
    document.getElementById("delete-exercise-modal").style.display = "block";
}

function closeDeleteExerciseModal() {
    exerciseLogToDelete = null;
    document.getElementById("delete-exercise-modal").style.display = "none";
}

async function confirmDeleteExercise() {
    if (!exerciseLogToDelete) {
        closeDeleteExerciseModal();
        return;
    }

    try {
        const response = await fetch(`/exercise-logs/${exerciseLogToDelete}`, {
            method: "DELETE",
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            closeDeleteExerciseModal();
            loadExerciseLogs();
        } else {
            const data = await response.json().catch(() => ({}));
            alert(data.detail || "Failed to delete exercise log.");
            closeDeleteExerciseModal();
        }
    } catch (error) {
        console.error("Error deleting exercise log:", error);
        alert("Something went wrong.");
        closeDeleteExerciseModal();
    }
}

function limitDecimals(input, maxPlaces) {
    input.value = input.value.replace(/[^0-9.]/g, "");
    const parts = input.value.split(".");
    if (parts.length > 2) {
        input.value = parts[0] + "." + parts.slice(1).join("");
    }
    const cleanParts = input.value.split(".");
    if (cleanParts.length === 2 && cleanParts[1].length > maxPlaces) {
        input.value = cleanParts[0] + "." + cleanParts[1].slice(0, maxPlaces);
    }
}

async function openAddExerciseModal() {
    const modal = document.getElementById("add-exercise-modal");
    if (modal) {
        modal.style.display = "block";
    }

    try {
        const response = await fetch("/exercises", {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            exerciseList = await response.json();
        }
    } catch (error) {
        console.error("Error fetching exercises:", error);
    }

    const searchInput = document.getElementById("exercise-search");
    if (searchInput) {
        searchInput.focus();
        searchInput.oninput = () => filterExerciseSearch(searchInput.value);
    }
}

function filterExerciseSearch(query) {
    const resultsEl = document.getElementById("exercise-results");
    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    selectedExercise = null;

    if (!query.trim()) {
        resultsEl.style.display = "none";
        return;
    }

    const lower = query.toLowerCase();
    const matches = exerciseList.filter(ex => ex.name.toLowerCase().includes(lower));

    if (matches.length === 0) {
        resultsEl.style.display = "none";
        return;
    }

    matches.forEach(ex => {
        const li = document.createElement("li");
        li.textContent = ex.name;
        li.onclick = () => {
            const exerciseSearch = document.getElementById("exercise-search");
            if (exerciseSearch) {
                exerciseSearch.value = ex.name;
            }
            selectedExercise = ex;
            resultsEl.innerHTML = "";
            resultsEl.style.display = "none";
        };
        resultsEl.appendChild(li);
    });

    resultsEl.style.display = "block";
}

function closeAddExerciseModal() {
    const modal = document.getElementById("add-exercise-modal");
    if (modal) {
        modal.style.display = "none";
    }

    const exerciseSearch = document.getElementById("exercise-search");
    const exerciseHours = document.getElementById("exercise-hours");
    const exerciseError = document.getElementById("exercise-error");
    const exerciseResults = document.getElementById("exercise-results");

    if (exerciseSearch) exerciseSearch.value = "";
    if (exerciseHours) exerciseHours.value = "";
    if (exerciseError) exerciseError.style.display = "none";
    if (exerciseResults) {
        exerciseResults.innerHTML = "";
        exerciseResults.style.display = "none";
    }

    exerciseList = [];
    selectedExercise = null;
}

async function addExerciseEntry() {
    const hoursInput = document.getElementById("exercise-hours")?.value.trim() || "";
    const errorEl = document.getElementById("exercise-error");

    if (!errorEl) return;
    errorEl.style.display = "none";

    if (!selectedExercise) {
        errorEl.textContent = "Please select an exercise from the list.";
        errorEl.style.display = "block";
        return;
    }

    if (!hoursInput) {
        errorEl.textContent = "Please enter the number of hours.";
        errorEl.style.display = "block";
        return;
    }

    const hours = parseFloat(hoursInput);

    if (isNaN(hours) || hours <= 0) {
        errorEl.textContent = "Hours must be a positive number.";
        errorEl.style.display = "block";
        return;
    }

    const decimalParts = hoursInput.split(".");
    if (decimalParts.length === 2 && decimalParts[1].length > 2) {
        errorEl.textContent = "Hours can have at most 2 decimal places (e.g. 0.25).";
        errorEl.style.display = "block";
        return;
    }

    const caloriesBurned = Math.round(selectedExercise.calories_per_hour * hours);

    try {
        const response = await fetch("/exercise-logs", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                exercise_name: selectedExercise.name,
                calories_burned: caloriesBurned,
                hours: hours
            })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            closeAddExerciseModal();
            loadExerciseLogs();
        } else {
            const data = await response.json();
            errorEl.textContent = data.detail || "Failed to log exercise.";
            errorEl.style.display = "block";
        }
    } catch (error) {
        console.error("Error logging exercise:", error);
        errorEl.textContent = "Something went wrong.";
        errorEl.style.display = "block";
    }
}

// ---------- Edit Exercise ----------
let exerciseLogToEdit = null;
let selectedEditExercise = null;
let editExerciseList = [];

async function openEditExerciseModal(log) {
    exerciseLogToEdit = log;

    const modal = document.getElementById("edit-exercise-modal");
    const searchInput = document.getElementById("edit-exercise-search");
    const hoursInput = document.getElementById("edit-exercise-hours");
    const errorEl = document.getElementById("edit-exercise-error");
    const resultsEl = document.getElementById("edit-exercise-results");

    if (!modal || !searchInput || !hoursInput) return;

    if (errorEl) errorEl.style.display = "none";
    if (resultsEl) {
        resultsEl.innerHTML = "";
        resultsEl.style.display = "none";
    }

    modal.style.display = "block";

    try {
        const response = await fetch("/exercises", { headers: getAuthHeaders(false) });
        if (response.status === 401) { logoutUser(); return; }
        if (response.ok) editExerciseList = await response.json();
    } catch (error) {
        console.error("Error fetching exercises:", error);
    }

    selectedEditExercise = editExerciseList.find(ex => ex.name === log.exercise_name) || null;
    searchInput.value = log.exercise_name;
    searchInput.oninput = () => filterEditExerciseSearch(searchInput.value);

    if (log.hours != null) {
        hoursInput.value = log.hours;
    } else if (selectedEditExercise && selectedEditExercise.calories_per_hour) {
        const derived = log.calories_burned / selectedEditExercise.calories_per_hour;
        hoursInput.value = derived.toFixed(2);
    } else {
        hoursInput.value = "";
    }
}

function filterEditExerciseSearch(query) {
    const resultsEl = document.getElementById("edit-exercise-results");
    if (!resultsEl) return;

    resultsEl.innerHTML = "";
    selectedEditExercise = null;

    if (!query.trim()) {
        resultsEl.style.display = "none";
        return;
    }

    const lower = query.toLowerCase();
    const matches = editExerciseList.filter(ex => ex.name.toLowerCase().includes(lower));

    if (matches.length === 0) {
        resultsEl.style.display = "none";
        return;
    }

    matches.forEach(ex => {
        const li = document.createElement("li");
        li.textContent = ex.name;
        li.onclick = () => {
            const searchInput = document.getElementById("edit-exercise-search");
            if (searchInput) searchInput.value = ex.name;
            selectedEditExercise = ex;
            resultsEl.innerHTML = "";
            resultsEl.style.display = "none";
        };
        resultsEl.appendChild(li);
    });

    resultsEl.style.display = "block";
}

function closeEditExerciseModal() {
    const modal = document.getElementById("edit-exercise-modal");
    if (modal) modal.style.display = "none";

    const searchInput = document.getElementById("edit-exercise-search");
    const hoursInput = document.getElementById("edit-exercise-hours");
    const errorEl = document.getElementById("edit-exercise-error");
    const resultsEl = document.getElementById("edit-exercise-results");

    if (searchInput) searchInput.value = "";
    if (hoursInput) hoursInput.value = "";
    if (errorEl) errorEl.style.display = "none";
    if (resultsEl) {
        resultsEl.innerHTML = "";
        resultsEl.style.display = "none";
    }

    exerciseLogToEdit = null;
    selectedEditExercise = null;
    editExerciseList = [];
}

async function saveExerciseEdit() {
    const errorEl = document.getElementById("edit-exercise-error");
    const hoursInput = document.getElementById("edit-exercise-hours");

    if (!errorEl || !hoursInput || !exerciseLogToEdit) return;
    errorEl.style.display = "none";

    if (!selectedEditExercise) {
        errorEl.textContent = "Please select an exercise from the list.";
        errorEl.style.display = "block";
        return;
    }

    const hoursRaw = hoursInput.value.trim();
    if (!hoursRaw) {
        errorEl.textContent = "Please enter the number of hours.";
        errorEl.style.display = "block";
        return;
    }

    const hours = parseFloat(hoursRaw);
    if (isNaN(hours) || hours <= 0) {
        errorEl.textContent = "Hours must be a positive number.";
        errorEl.style.display = "block";
        return;
    }

    const decimalParts = hoursRaw.split(".");
    if (decimalParts.length === 2 && decimalParts[1].length > 2) {
        errorEl.textContent = "Hours can have at most 2 decimal places (e.g. 0.25).";
        errorEl.style.display = "block";
        return;
    }

    const caloriesBurned = Math.round(selectedEditExercise.calories_per_hour * hours);

    try {
        const response = await fetch(`/exercise-logs/${exerciseLogToEdit.id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                exercise_name: selectedEditExercise.name,
                calories_burned: caloriesBurned,
                hours: hours
            })
        });

        if (response.status === 401) { logoutUser(); return; }

        if (response.ok) {
            closeEditExerciseModal();
            loadExerciseLogs();
        } else {
            const data = await response.json().catch(() => ({}));
            errorEl.textContent = data.detail || "Failed to update exercise log.";
            errorEl.style.display = "block";
        }
    } catch (error) {
        console.error("Error updating exercise log:", error);
        errorEl.textContent = "Something went wrong.";
        errorEl.style.display = "block";
    }
}

// ---------- Admin page ----------
let adminUsers = [];

async function setupAdminPage() {
    const adminUserList = document.getElementById("admin-user-list");
    const emptyLabel = document.getElementById("admin-empty");

    if (!adminUserList || !emptyLabel) return;

    const token = getToken();
    if (!token) {
        window.location.href = "/login";
        return;
    }

    const currentUser = await fetchCurrentUserFromToken();

    if (!currentUser) {
        logoutUser();
        return;
    }

    if (currentUser.role !== "admin") {
        window.location.href = "/tracker";
        return;
    }

    renderUserHeader(currentUser);
    loadAdminUsers();
}

async function loadAdminUsers() {
    const listElement = document.getElementById("admin-user-list");
    const emptyLabel = document.getElementById("admin-empty");

    if (!listElement || !emptyLabel) return;

    try {
        const response = await fetch("/admin/users", {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.status === 403) {
            window.location.href = "/tracker";
            return;
        }

        adminUsers = await response.json();
        renderAdminUsers(adminUsers);
    } catch (error) {
        console.error("Error loading admin users:", error);
    }
}

function renderAdminUsers(users) {
    const listElement = document.getElementById("admin-user-list");
    const emptyLabel = document.getElementById("admin-empty");
    const currentUser = getCurrentUser();

    if (!listElement || !emptyLabel) return;

    listElement.innerHTML = "";

    if (users.length === 0) {
        emptyLabel.style.display = "block";
        return;
    }

    emptyLabel.style.display = "none";

    users.forEach(user => {
        const li = document.createElement("li");
        li.className = "item";

        const isCurrentUser = currentUser && currentUser.id === user.id;

        li.innerHTML = `
            <div class="item-info">
                <strong>${escapeHtml(user.username)}</strong> - ${escapeHtml(user.email)} (${escapeHtml(user.role)})
            </div>
            <div class="actions">
                <select onchange="changeUserRole('${user.id}', this.value)" ${isCurrentUser ? "disabled" : ""}>
                    <option value="user" ${user.role === "user" ? "selected" : ""}>User</option>
                    <option value="admin" ${user.role === "admin" ? "selected" : ""}>Admin</option>
                </select>
                <button class="delete-btn" onclick="deleteAdminUser('${user.id}')" ${isCurrentUser ? "disabled" : ""}>Delete</button>
            </div>
        `;

        listElement.appendChild(li);
    });
}

function filterAdminUsers() {
    const searchInput = document.getElementById("admin-user-search");
    if (!searchInput) return;

    const query = searchInput.value.trim().toLowerCase();

    const filteredUsers = adminUsers.filter(user =>
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
    );

    renderAdminUsers(filteredUsers);
}

async function changeUserRole(userId, newRole) {
    try {
        const response = await fetch(`/admin/users/${userId}/role`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ role: newRole })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.status === 403) {
            window.location.href = "/tracker";
            return;
        }

        if (response.ok) {
            loadAdminUsers();
        } else {
            const data = await response.json();
            alert(data.detail || "Failed to update role.");
            loadAdminUsers();
        }
    } catch (error) {
        console.error("Error updating role:", error);
        alert("Something went wrong.");
        loadAdminUsers();
    }
}

async function deleteAdminUser(userId) {
    const confirmed = confirm("Are you sure you want to delete this user?");
    if (!confirmed) return;

    try {
        const response = await fetch(`/admin/users/${userId}`, {
            method: "DELETE",
            headers: getAuthHeaders(false)
        });

        if (response.ok) {
            loadAdminUsers();
        } else {
            const data = await response.json();
            alert(data.detail || "Failed to delete user.");
        }
    } catch (error) {
        console.error("Error deleting user:", error);
        alert("Something went wrong.");
    }
}

// ---------- Social Feed ----------
async function setupFeedPage() {
    const feedContainer = document.getElementById("feed-posts");

    if (!feedContainer) return;

    const token = getToken();
    if (!token) {
        window.location.href = "/login";
        return;
    }

    const currentUser = await fetchCurrentUserFromToken();
    if (!currentUser) {
        logoutUser();
        return;
    }

    renderUserHeader(currentUser);

    feedOffset = 0;
    feedLimit = 10;
    isLoadingFeed = false;
    hasMoreFeedPosts = true;
    feedContainer.innerHTML = "";

    const endEl = document.getElementById("feed-end");
    if (endEl) {
        endEl.style.display = "none";
    }

    await loadFeedPosts();

    window.removeEventListener("scroll", handleFeedScroll);
    window.addEventListener("scroll", handleFeedScroll);
}

async function loadFeedPosts() {
    if (isLoadingFeed || !hasMoreFeedPosts) return;

    isLoadingFeed = true;

    const loadingEl = document.getElementById("feed-loading");
    if (loadingEl) {
        loadingEl.style.display = "block";
    }

    try {
        const response = await fetch(`/posts?skip=${feedOffset}&limit=${feedLimit}`, {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const posts = await response.json();

        if (posts.length < feedLimit) {
            hasMoreFeedPosts = false;

            const endEl = document.getElementById("feed-end");
            if (endEl) {
                endEl.style.display = "block";
            }
        }

        appendFeedPosts(posts);
        feedOffset += posts.length;
    } catch (error) {
        console.error("Error loading posts:", error);
    } finally {
        isLoadingFeed = false;

        if (loadingEl) {
            loadingEl.style.display = "none";
        }
    }
}

function handleFeedScroll() {
    if (isLoadingFeed || !hasMoreFeedPosts) return;

    const scrollTop = window.scrollY;
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollTop + windowHeight >= documentHeight - 250) {
        loadFeedPosts();
    }
}

function appendFeedPosts(posts) {
    const container = document.getElementById("feed-posts");
    if (!container) return;

    if (posts.length === 0 && feedOffset === 0) {
        container.innerHTML = `
            <p class="empty-label">No posts yet. Be the first to post.</p>
        `;
        return;
    }

    const currentUser = getCurrentUser();

    posts.forEach((post, postIndex) => {
        const globalIndex = feedOffset + postIndex;

        const card = document.createElement("article");
        card.className = "feed-post-card";

        const hasImages = post.images && post.images.length > 0;
        const multipleImages = hasImages && post.images.length > 1;
        const isLiked = post.liked_by && currentUser && post.liked_by.includes(currentUser.id);

        const imagesHtml = hasImages
            ? `
                <div class="feed-carousel" id="feed-carousel-${globalIndex}" data-index="0" data-total="${post.images.length}">
                    ${multipleImages ? `<button type="button" class="carousel-btn prev-btn" onclick="changeSlide(${globalIndex}, -1, event)">‹</button>` : ""}
                    
                    <div class="feed-carousel-track" id="carousel-track-${globalIndex}">
                        ${post.images.map(image => `
                            <img src="${image}" class="feed-post-image" alt="Post image" draggable="false">
                        `).join("")}
                    </div>

                    ${multipleImages ? `<button type="button" class="carousel-btn next-btn" onclick="changeSlide(${globalIndex}, 1, event)">›</button>` : ""}
                </div>

                ${multipleImages ? `
                    <div class="carousel-dots">
                        ${post.images.map((_, imageIndex) => `
                            <button
                                type="button"
                                class="carousel-dot ${imageIndex === 0 ? "active-dot" : ""}"
                                id="dot-${globalIndex}-${imageIndex}"
                                onclick="goToSlide(${globalIndex}, ${imageIndex}, event)">
                            </button>
                        `).join("")}
                    </div>
                ` : ""}
            `
            : `<div class="feed-post-image-placeholder">No Image</div>`;

        card.innerHTML = `
            <div class="feed-post-header">
                <div class="feed-user-avatar">
                    ${post.username.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div class="feed-username">${escapeHtml(post.username)}</div>
                    <div class="feed-post-date">${formatPostDate(post.created_at)}</div>
                </div>
            </div>

            ${imagesHtml}

            <div class="feed-post-body">
                <p class="feed-post-caption" id="caption-${post.id}">${escapeHtml(post.caption)}</p>

                <div class="feed-post-actions">
                    <button 
                        type="button"
                        class="like-btn ${isLiked ? "liked" : ""}" 
                        onclick="toggleLike('${post.id}', this)">
                        ${isLiked ? "❤️" : "🤍"}
                    </button>
                    <span class="like-count">${post.likes || 0}</span>
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function changeSlide(postIndex, direction, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const carousel = document.getElementById(`feed-carousel-${postIndex}`);
    const track = document.getElementById(`carousel-track-${postIndex}`);
    if (!carousel || !track) return;

    const total = parseInt(carousel.dataset.total || "0", 10);
    if (total <= 1) return;

    let currentIndex = parseInt(carousel.dataset.index || "0", 10);
    currentIndex = (currentIndex + direction + total) % total;

    carousel.dataset.index = String(currentIndex);
    updateCarousel(postIndex, currentIndex);
}

function goToSlide(postIndex, slideIndex, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const carousel = document.getElementById(`feed-carousel-${postIndex}`);
    if (!carousel) return;

    carousel.dataset.index = String(slideIndex);
    updateCarousel(postIndex, slideIndex);
}

function updateCarousel(postIndex, currentIndex) {
    const track = document.getElementById(`carousel-track-${postIndex}`);
    if (!track) return;

    const slides = track.querySelectorAll(".feed-post-image");
    if (!slides.length) return;

    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    slides.forEach((_, index) => {
        const dot = document.getElementById(`dot-${postIndex}-${index}`);
        if (dot) {
            dot.classList.toggle("active-dot", index === currentIndex);
        }
    });
}

function formatPostDate(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();

    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";

    return date.toLocaleDateString();
}

async function toggleLike(postId, button) {
    try {
        const response = await fetch(`/posts/${postId}/like`, {
            method: "POST",
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();

        if (response.ok) {
            const liked = data.liked;
            const likes = data.likes;

            button.textContent = liked ? "❤️" : "🤍";
            button.classList.toggle("liked", liked);

            const countEl = button.nextElementSibling;
            if (countEl) {
                countEl.textContent = likes;
            }

            loadProfileStats();
        }
    } catch (error) {
        console.error("Error liking post:", error);
    }
}

// ---------- Create post page ----------
async function setupCreatePostPage() {
    const usernameEl = document.getElementById("create-post-username");
    const imageInput = document.getElementById("post-images");

    if (!usernameEl || !imageInput) return;

    const token = getToken();
    if (!token) {
        window.location.href = "/login";
        return;
    }

    const currentUser = await fetchCurrentUserFromToken();
    if (!currentUser) {
        logoutUser();
        return;
    }

    renderUserHeader(currentUser);
    usernameEl.textContent = currentUser.username;

    imageInput.addEventListener("change", previewPostImages);
}

function previewPostImages() {
    const imageInput = document.getElementById("post-images");
    const preview = document.getElementById("post-image-preview");

    if (!imageInput || !preview) return;

    preview.innerHTML = "";

    const files = Array.from(imageInput.files);

    if (files.length > 5) {
        alert("You can upload a maximum of 5 images.");
        imageInput.value = "";
        return;
    }

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const img = document.createElement("img");
            img.src = e.target.result;
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}

async function submitPost() {
    const imageInput = document.getElementById("post-images");
    const captionInput = document.getElementById("post-caption");
    const message = document.getElementById("create-post-message");

    if (!imageInput || !captionInput || !message) return;

    const files = Array.from(imageInput.files);
    const caption = captionInput.value.trim();

    if (files.length < 1 || files.length > 5) {
        message.textContent = "Please upload between 1 and 5 images.";
        message.style.color = "red";
        return;
    }

    const formData = new FormData();
    formData.append("caption", caption);

    files.forEach(file => {
        formData.append("images", file);
    });

    try {
        const response = await fetch("/posts", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${getToken()}`
            },
            body: formData
        });

        const data = await response.json();

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            message.textContent = "Post created successfully.";
            message.style.color = "green";

            setTimeout(() => {
                window.location.href = "/feed";
            }, 1000);
        } else {
            message.textContent = data.detail || "Failed to create post.";
            message.style.color = "red";
        }
    } catch (error) {
        console.error("Error creating post:", error);
        message.textContent = "Something went wrong.";
        message.style.color = "red";
    }
}

// ---------- Profile page ----------
async function setupProfilePage() {
    const profilePosts = document.getElementById("profile-posts");
    const profileUsername = document.getElementById("profile-username");
    const postCountEl = document.getElementById("profile-post-count");
    const totalLikesEl = document.getElementById("profile-total-likes");

    if (!profilePosts || !profileUsername || !postCountEl || !totalLikesEl) return;

    const token = getToken();
    if (!token) {
        window.location.href = "/login";
        return;
    }

    const currentUser = await fetchCurrentUserFromToken();
    if (!currentUser) {
        logoutUser();
        return;
    }

    renderUserHeader(currentUser);
    profileUsername.textContent = `${currentUser.username}'s Profile`;

    await loadProfileStats();
    await loadProfilePosts();
}

async function loadProfileStats() {
    const postCountEl = document.getElementById("profile-post-count");
    const totalLikesEl = document.getElementById("profile-total-likes");
    if (!postCountEl || !totalLikesEl) return;

    try {
        const response = await fetch("/my-profile-stats", {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const stats = await response.json();
        postCountEl.textContent = stats.post_count ?? 0;
        totalLikesEl.textContent = stats.total_likes ?? 0;
    } catch (error) {
        console.error("Error loading profile stats:", error);
    }
}

async function loadProfilePosts() {
    try {
        const response = await fetch("/my-posts", {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const posts = await response.json();
        renderProfilePosts(posts);
    } catch (error) {
        console.error("Error loading profile posts:", error);
    }
}

function renderProfilePosts(posts) {
    const container = document.getElementById("profile-posts");
    if (!container) return;

    container.innerHTML = "";

    if (posts.length === 0) {
        container.innerHTML = `
            <p class="empty-label">You have not posted yet.</p>
        `;
        return;
    }

    const currentUser = getCurrentUser();

    posts.forEach((post, postIndex) => {
        const card = document.createElement("article");
        card.className = "feed-post-card";

        const hasImages = post.images && post.images.length > 0;
        const multipleImages = hasImages && post.images.length > 1;
        const isLiked = post.liked_by && currentUser && post.liked_by.includes(currentUser.id);
        const isOwner = currentUser && post.user_id === currentUser.id;

        const imagesHtml = hasImages
            ? `
                <div class="feed-carousel" id="feed-carousel-profile-${postIndex}" data-index="0" data-total="${post.images.length}">
                    ${multipleImages ? `<button type="button" class="carousel-btn prev-btn" onclick="changeProfileSlide(${postIndex}, -1, event)">‹</button>` : ""}
                    
                    <div class="feed-carousel-track" id="carousel-track-profile-${postIndex}">
                        ${post.images.map(image => `
                            <img src="${image}" class="feed-post-image" alt="Post image" draggable="false">
                        `).join("")}
                    </div>

                    ${multipleImages ? `<button type="button" class="carousel-btn next-btn" onclick="changeProfileSlide(${postIndex}, 1, event)">›</button>` : ""}
                </div>

                ${multipleImages ? `
                    <div class="carousel-dots">
                        ${post.images.map((_, imageIndex) => `
                            <button
                                type="button"
                                class="carousel-dot ${imageIndex === 0 ? "active-dot" : ""}"
                                id="dot-profile-${postIndex}-${imageIndex}"
                                onclick="goToProfileSlide(${postIndex}, ${imageIndex}, event)">
                            </button>
                        `).join("")}
                    </div>
                ` : ""}
            `
            : `<div class="feed-post-image-placeholder">No Image</div>`;

        card.innerHTML = `
            <div class="feed-post-header">
                <div class="feed-user-avatar">
                    ${post.username.charAt(0).toUpperCase()}
                </div>
                <div>
                    <div class="feed-username">${escapeHtml(post.username)}</div>
                    <div class="feed-post-date">${formatPostDate(post.created_at)}</div>
                </div>
            </div>

            ${imagesHtml}

            <div class="feed-post-body">
                <p class="feed-post-caption" id="caption-${post.id}">${escapeHtml(post.caption)}</p>

                <div class="feed-post-actions">
                    <button 
                        type="button"
                        class="like-btn ${isLiked ? "liked" : ""}" 
                        onclick="toggleLike('${post.id}', this)">
                        ${isLiked ? "❤️" : "🤍"}
                    </button>
                    <span class="like-count">${post.likes || 0}</span>

                    ${isOwner ? `
                        <button type="button" class="edit-btn" onclick="editPost('${post.id}')">Edit</button>
                        <button type="button" class="delete-btn" onclick="deletePost('${post.id}')">Delete</button>
                    ` : ""}
                </div>
            </div>
        `;

        container.appendChild(card);
    });
}

function changeProfileSlide(postIndex, direction, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const carousel = document.getElementById(`feed-carousel-profile-${postIndex}`);
    const track = document.getElementById(`carousel-track-profile-${postIndex}`);
    if (!carousel || !track) return;

    const total = parseInt(carousel.dataset.total || "0", 10);
    if (total <= 1) return;

    let currentIndex = parseInt(carousel.dataset.index || "0", 10);
    currentIndex = (currentIndex + direction + total) % total;

    carousel.dataset.index = String(currentIndex);
    updateProfileCarousel(postIndex, currentIndex);
}

function goToProfileSlide(postIndex, slideIndex, event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const carousel = document.getElementById(`feed-carousel-profile-${postIndex}`);
    if (!carousel) return;

    carousel.dataset.index = String(slideIndex);
    updateProfileCarousel(postIndex, slideIndex);
}

function updateProfileCarousel(postIndex, currentIndex) {
    const track = document.getElementById(`carousel-track-profile-${postIndex}`);
    if (!track) return;

    const slides = track.querySelectorAll(".feed-post-image");
    if (!slides.length) return;

    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    slides.forEach((_, index) => {
        const dot = document.getElementById(`dot-profile-${postIndex}-${index}`);
        if (dot) {
            dot.classList.toggle("active-dot", index === currentIndex);
        }
    });
}

async function editPost(postId) {
    const captionEl = document.getElementById(`caption-${postId}`);
    if (!captionEl) return;

    const currentCaption = captionEl.textContent;
    const newCaption = prompt("Edit your caption:", currentCaption);

    if (newCaption === null) return;

    const trimmedCaption = newCaption.trim();
    if (!trimmedCaption) {
        alert("Caption cannot be empty.");
        return;
    }

    try {
        const response = await fetch(`/posts/${postId}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ caption: trimmedCaption })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();

        if (response.ok) {
            captionEl.textContent = data.caption;
            loadProfilePosts();
        } else {
            alert(data.detail || "Failed to update post.");
        }
    } catch (error) {
        console.error("Error editing post:", error);
        alert("Something went wrong.");
    }
}

async function deletePost(postId) {
    const confirmed = confirm("Are you sure you want to delete this post?");
    if (!confirmed) return;

    try {
        const response = await fetch(`/posts/${postId}`, {
            method: "DELETE",
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            loadProfilePosts();
            loadProfileStats();
        } else {
            const data = await response.json();
            alert(data.detail || "Failed to delete post.");
        }
    } catch (error) {
        console.error("Error deleting post:", error);
        alert("Something went wrong.");
    }
}

// ---------- Settings page ----------
async function setupSettingsPage() {
    const currentUsernameEl = document.getElementById("settings-current-username");
    const currentEmailEl = document.getElementById("settings-current-email");
    const themeSelect = document.getElementById("theme-select");

    if (!currentUsernameEl || !currentEmailEl) return;

    const token = getToken();
    if (!token) {
        window.location.href = "/login";
        return;
    }

    const currentUser = await fetchCurrentUserFromToken();
    if (!currentUser) {
        logoutUser();
        return;
    }

    renderUserHeader(currentUser);

    currentUsernameEl.textContent = currentUser.username;
    currentEmailEl.textContent = currentUser.email;

    if (themeSelect) {
        themeSelect.value = localStorage.getItem("nutriTheme") || "light";
    }
}

async function submitUsernameChange() {
    const newUsernameInput = document.getElementById("settings-new-username");
    const messageEl = document.getElementById("settings-username-message");
    const currentUsernameEl = document.getElementById("settings-current-username");

    if (!newUsernameInput || !messageEl || !currentUsernameEl) return;

    const newUsername = newUsernameInput.value.trim();

    if (!newUsername) {
        messageEl.textContent = "Please enter a new username.";
        messageEl.style.color = "red";
        return;
    }

    try {
        const response = await fetch("/settings/username", {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ new_username: newUsername })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem("nutriUser", JSON.stringify(data));
            currentUsernameEl.textContent = data.username;
            newUsernameInput.value = "";
            messageEl.textContent = "Username updated successfully.";
            messageEl.style.color = "green";

            renderUserHeader(data);
        } else {
            messageEl.textContent = data.detail || "Failed to update username.";
            messageEl.style.color = "red";
        }
    } catch (error) {
        console.error("Error updating username:", error);
        messageEl.textContent = "Something went wrong.";
        messageEl.style.color = "red";
    }
}

async function submitPasswordChange() {
    const currentPasswordInput = document.getElementById("settings-current-password");
    const newPasswordInput = document.getElementById("settings-new-password");
    const messageEl = document.getElementById("settings-password-message");

    if (!currentPasswordInput || !newPasswordInput || !messageEl) return;

    const current_password = currentPasswordInput.value.trim();
    const new_password = newPasswordInput.value.trim();

    if (!current_password || !new_password) {
        messageEl.textContent = "Please fill out both password fields.";
        messageEl.style.color = "red";
        return;
    }

    try {
        const response = await fetch("/settings/password", {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ current_password, new_password })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();

        if (response.ok) {
            currentPasswordInput.value = "";
            newPasswordInput.value = "";
            messageEl.textContent = data.message || "Password updated successfully.";
            messageEl.style.color = "green";
        } else {
            messageEl.textContent = data.detail || "Failed to update password.";
            messageEl.style.color = "red";
        }
    } catch (error) {
        console.error("Error updating password:", error);
        messageEl.textContent = "Something went wrong.";
        messageEl.style.color = "red";
    }
}

// ---------- Small helper ----------
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}