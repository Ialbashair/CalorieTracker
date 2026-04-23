console.log("SCRIPT.JS LOADED");

const REGISTER_URL = "/register";
const LOGIN_URL = "/login";

// ---------- Page setup ----------
window.onload = async () => {
    setupRegisterForm();
    setupLoginForm();
    await setupCaloriePage();
    await setupAdminPage();
    await setupVisualizationPage();
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
                    window.location.href = "/tracker";
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
    const header = document.querySelector("header");
    if (!header || !user) return;

    let userBar = document.getElementById("user-bar");

    if (!userBar) {
        userBar = document.createElement("div");
        userBar.id = "user-bar";
        userBar.style.marginTop = "10px";
        userBar.style.display = "flex";
        userBar.style.justifyContent = "space-between";
        userBar.style.alignItems = "center";
        userBar.style.gap = "10px";

        header.appendChild(userBar);
    }

    const isAdminPage = window.location.pathname === "/admin";

    const navLink = user.role === "admin"
        ? isAdminPage
            ? `<a href="/tracker" style="font-weight:600; color: var(--primary); text-decoration:none;">Tracker</a>`
            : `<a href="/admin" style="font-weight:600; color: var(--primary); text-decoration:none;">Admin</a>`
        : "";

    userBar.innerHTML = `
        <span>Logged in as <strong>${escapeHtml(user.username)}</strong> (${escapeHtml(user.role)})</span>
        <div style="display:flex; gap:10px; align-items:center;">
            ${navLink}
            <button onclick="logoutUser()">Logout</button>
        </div>
    `;
}

// ---------- Tracker page ----------
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
    loadFoodLogs();
    loadExerciseLogs();
}

// ---------- Visualization page ----------
async function setupVisualizationPage() {
    const graphContainer = document.getElementById("graph-container");

    if (!graphContainer) return;

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

    let food     = await fetchFoodLogs();
    let exercise = await fetchExerciseLogs();

    let total_timestamps = [];
    let total_calories   = [];

    let fi = 0;
    let ei = 0;
    let total = 0;
    while (fi < food.length || ei < exercise.length) {
        let ft = (fi < food.length)     ? Date.parse(food[fi].created_at)     : null;
        let et = (ei < exercise.length) ? Date.parse(exercise[fi].created_at) : null;

        if (et === null || ft < et) {
            total += food[fi].calories;
            total_timestamps.push(food[fi].created_at);
            fi += 1;
        }
        else if (ft === null || et < ft) {
            total -= exercise[ei].calories_burned;
            total_timestamps.push(exercise[ei].created_at);
            ei += 1;
        }
        else {
            total += food[fi].calories - exercise[ei].calories_burned;
            total_timestamps.push(food[fi].created_at);
            ft += 1;
            ei += 1;
        }

        total_calories.push(total);
    }

    let gained = {
        x: food.map(x => x.created_at),
        y: food.map(x => x.calories),
        // text: []
        type: "scatter",
        name: "gained",
        marker: {
            color: "green",
        },
    };

    let burned = {
        x: exercise.map(x => x.created_at),
        y: exercise.map(x => x.calories_burned),
        type: "scatter",
        name: "burned",
        marker: {
            color: "red",
        },
    };

    let total_line = {
        x: total_timestamps,
        y: total_calories,
        type: "scatter",
        name: "total",
        marker: {
            color: "grey",
        },
    };

    let data = [gained, burned, total_line];

    let layout = {
        title: {
            text: "Calories Burned/Gained",
        },
    }

    let config = {
        scrollZoom: true,
    }

    Plotly.newPlot(graphContainer, data, layout, config);
}

// ---------- Food section ----------
async function loadFoodLogs() {
    let data = await fetchFoodLogs();

    if (data !== null) {
        renderFoodList(data);
    }
}

async function fetchFoodLogs() {
    try {
        const response = await fetch("/food-logs", {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching food logs:", error);
        return null;
    }
}

function renderFoodList(logs) {
    const listElement = document.getElementById("calorie-list");
    const totalDisplay = document.getElementById("total-calories");
    const emptyLabel = document.getElementById("food-empty");

    if (!listElement || !totalDisplay || !emptyLabel) return;

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

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn food-delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => openDeleteFoodModal(log.id);
        li.appendChild(deleteBtn);

        listElement.appendChild(li);
    });

    totalDisplay.innerText = total;
}

let foodList = [];
let selectedFood = null;

async function openAddFoodModal() {
    document.getElementById("add-food-modal").style.display = "block";

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
    searchInput.focus();
    searchInput.oninput = () => filterFoodSearch(searchInput.value);
}

function filterFoodSearch(query) {
    const resultsEl = document.getElementById("food-results");
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
            document.getElementById("food-search").value = f.name;
            selectedFood = f;
            resultsEl.innerHTML = "";
            resultsEl.style.display = "none";
        };
        resultsEl.appendChild(li);
    });

    resultsEl.style.display = "block";
}

function closeAddFoodModal() {
    document.getElementById("add-food-modal").style.display = "none";
    document.getElementById("food-search").value = "";
    document.getElementById("food-grams").value = "";
    document.getElementById("food-error").style.display = "none";
    document.getElementById("food-results").innerHTML = "";
    document.getElementById("food-results").style.display = "none";
    foodList = [];
    selectedFood = null;
}

async function addFoodEntry() {
    const gramsInput = document.getElementById("food-grams").value.trim();
    const errorEl = document.getElementById("food-error");

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
                calories: calories
            })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            closeAddFoodModal();
            loadFoodLogs();
            // closeAddFoodModal();
            // loadFoodLogs();
        } else {
            const data = await response.json();
            errorEl.textContent = data.detail || "Failed to log food.";
            errorEl.style.display = "block";
            errorEl.textContent = data.detail || "Failed to log food.";
            errorEl.style.display = "block";
        }
    } catch (error) {
        console.error("Error logging food:", error);
        errorEl.textContent = "Something went wrong.";
        errorEl.style.display = "block";
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

// ---------- Exercise section ----------
async function loadExerciseLogs() {
    let data = await fetchExerciseLogs();

    if (data !== null) {
        renderExerciseList(data);
    }
}

async function fetchExerciseLogs() {
    try {
        const response = await fetch("/exercise-logs", {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching exercise logs:", error);
        return null;
    }
}

function renderExerciseList(logs) {
    const listElement = document.getElementById("exercise-list");
    const emptyLabel = document.getElementById("exercise-empty");
    if (!listElement || !emptyLabel) return;

    listElement.innerHTML = "";

    if (logs.length === 0) {
        emptyLabel.style.display = "block";
    } else {
        emptyLabel.style.display = "none";
    }

    logs.forEach(log => {
        const li = document.createElement("li");
        li.className = "item exercise-item";

        const itemInfo = document.createElement("div");
        itemInfo.className = "item-info";
        const strong = document.createElement("strong");
        strong.textContent = log.exercise_name;
        itemInfo.appendChild(strong);
        itemInfo.append(` - ${log.calories_burned} kcal burned`);

        li.appendChild(itemInfo);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn exercise-delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => openDeleteExerciseModal(log.id);
        li.appendChild(deleteBtn);

        listElement.appendChild(li);
    });
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

let exerciseList = [];
let selectedExercise = null;

async function openAddExerciseModal() {
    document.getElementById("add-exercise-modal").style.display = "block";

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
        console.error("Error fetching exercises:", error);
    }

    const searchInput = document.getElementById("exercise-search");
    searchInput.focus();
    searchInput.oninput = () => filterExerciseSearch(searchInput.value);
}

function filterExerciseSearch(query) {
    const resultsEl = document.getElementById("exercise-results");
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
            document.getElementById("exercise-search").value = ex.name;
            selectedExercise = ex;
            resultsEl.innerHTML = "";
            resultsEl.style.display = "none";
        };
        resultsEl.appendChild(li);
    });

    resultsEl.style.display = "block";
}

function closeAddExerciseModal() {
    document.getElementById("add-exercise-modal").style.display = "none";
    document.getElementById("exercise-search").value = "";
    document.getElementById("exercise-hours").value = "";
    document.getElementById("exercise-error").style.display = "none";
    document.getElementById("exercise-results").innerHTML = "";
    document.getElementById("exercise-results").style.display = "none";
    exerciseList = [];
    selectedExercise = null;
}

async function addExerciseEntry() {
    const hoursInput = document.getElementById("exercise-hours").value.trim();
    const errorEl = document.getElementById("exercise-error");

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
                calories_burned: caloriesBurned
            })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            closeAddExerciseModal();
            loadExerciseLogs();
            // closeAddExerciseModal();
            // loadExerciseLogs();
        } else {
            const data = await response.json();
            errorEl.textContent = data.detail || "Failed to log exercise.";
            errorEl.style.display = "block";
            errorEl.textContent = data.detail || "Failed to log exercise.";
            errorEl.style.display = "block";
        }
    } catch (error) {
        console.error("Error logging exercise:", error);
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

// ---------- Small helper ----------
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}