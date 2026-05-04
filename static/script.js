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
    await setupStatsPage();
    await setupCreatePostPage();
    await setupFeedPage();
    await setupProfilePage();
    await setupSettingsPage();
    await setupWeeklyRecapPage();
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

    if (latestWeeklyRecap) {
        drawWeeklyRecapCard(latestWeeklyRecap);
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
    const homeProfilePictureEl = document.getElementById("home-profile-picture");
    if (homeProfilePictureEl) {
        homeProfilePictureEl.innerHTML = getProfileAvatarHtml(currentUser, "avatar-large");
    }

    if (currentUser.created_at) {
        const date = new Date(currentUser.created_at);
        userSinceEl.textContent = `User Since ${date.toLocaleDateString()}`;
    } else {
        userSinceEl.textContent = "User Since --";
    }

    await loadUserGoals();
    await loadHomeDailyTotals();
}

async function loadHomeDailyTotals() {
    try {
        const today = formatTrackerDateForApi(startOfLocalDay(new Date()));

        const foodResponse = await fetch(`/food-logs?date=${today}`, {
            headers: getAuthHeaders(false)
        });

        const exerciseResponse = await fetch(`/exercise-logs?date=${today}`, {
            headers: getAuthHeaders(false)
        });

        const waterResponse = await fetch(`/water-logs?date=${today}`, {
            headers: getAuthHeaders(false)
        });

        if (
            foodResponse.status === 401 ||
            exerciseResponse.status === 401 ||
            waterResponse.status === 401
        ) {
            logoutUser();
            return;
        }

        const foodLogs = await foodResponse.json();
        const exerciseLogs = await exerciseResponse.json();
        const waterLogs = await waterResponse.json();

        homeCaloriesConsumedToday = foodLogs.reduce((sum, log) => {
            return sum + (Number(log.calories) || 0);
        }, 0);

        homeCaloriesBurnedToday = exerciseLogs.reduce((sum, log) => {
            return sum + (Number(log.calories_burned) || 0);
        }, 0);

        homeWaterTotalToday = waterLogs.reduce((sum, log) => {
            return sum + (Number(log.amount_ml) || 0);
        }, 0);

        const consumedEl = document.getElementById("home-calories-consumed");
        const burnedEl = document.getElementById("home-calories-burned");
        const netEl = document.getElementById("home-net-calories");

        if (consumedEl) consumedEl.textContent = homeCaloriesConsumedToday;
        if (burnedEl) burnedEl.textContent = homeCaloriesBurnedToday;
        if (netEl) netEl.textContent = homeCaloriesConsumedToday - homeCaloriesBurnedToday;

        updateHomeGoalProgress();
    } catch (error) {
        console.error("Error loading home daily totals:", error);

        homeCaloriesConsumedToday = 0;
        homeCaloriesBurnedToday = 0;
        homeWaterTotalToday = 0;

        updateHomeGoalProgress();
    }
}

async function loadHomeWaterTotal() {
    try {
        const today = formatTrackerDateForApi(startOfLocalDay(new Date()));

        const response = await fetch(`/water-logs?date=${today}`, {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const logs = await response.json();

        homeWaterTotalToday = logs.reduce((sum, log) => {
            return sum + (Number(log.amount_ml) || 0);
        }, 0);

        updateHomeGoalProgress();
    } catch (error) {
        console.error("Error loading home water total:", error);
        homeWaterTotalToday = 0;
        updateHomeGoalProgress();
    }
}

function updateHomeGoalProgress() {
    updateGoalProgress(
        "home-food-goal-label",
        "home-food-goal-fill",
        homeCaloriesConsumedToday,
        userGoals.calorie_goal,
        "kcal"
    );

    updateGoalProgress(
        "home-exercise-goal-label",
        "home-exercise-goal-fill",
        homeCaloriesBurnedToday,
        userGoals.exercise_goal,
        "kcal burned"
    );

    updateGoalProgress(
        "home-water-goal-label",
        "home-water-goal-fill",
        homeWaterTotalToday,
        userGoals.water_goal_ml,
        "mL"
    );
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
    setTrackerSelectedDate(next);
}

function setTrackerSelectedDate(date) {
    trackerSelectedDate = startOfLocalDay(date);

    foodCaloriesTotal = 0;
    exerciseCaloriesTotal = 0;
    updateCalorieTotals();

    renderTrackerDateLabel();
    syncTrackerDateInput();
    loadFoodLogs();
    loadExerciseLogs();
    loadWaterLogs();
}

function syncTrackerDateInput() {
    const input = document.getElementById("tracker-date-input");
    if (input) input.value = formatTrackerDateForApi(trackerSelectedDate);
}

function openTrackerDatePicker() {
    const input = document.getElementById("tracker-date-input");
    if (!input) return;
    syncTrackerDateInput();
    if (typeof input.showPicker === "function") {
        input.showPicker();
    } else {
        input.focus();
        input.click();
    }
}

function onTrackerDatePicked(value) {
    if (!value) return;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return;
    setTrackerSelectedDate(new Date(y, m - 1, d));
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
    syncTrackerDateInput();

    await loadUserGoals();
    loadFoodLogs();
    loadExerciseLogs();
    loadWaterLogs();
}

function updateCaloriePage() {
    foodCaloriesTotal = 0;
    exerciseCaloriesTotal = 0;
    updateCalorieTotals();
    loadFoodLogs();
    loadExerciseLogs();
    loadWaterLogs();
}

function getPreviousTrackerDateString() {
    const previousDate = new Date(trackerSelectedDate);
    previousDate.setDate(previousDate.getDate() - 1);
    return formatTrackerDateForApi(previousDate);
}

function getCurrentTrackerDateString() {
    return formatTrackerDateForApi(trackerSelectedDate);
}

async function copyPreviousFoodLogs() {
    const previousDate = getPreviousTrackerDateString();
    const currentDate = getCurrentTrackerDateString();

    const confirmed = confirm(`Copy all food logs from ${previousDate} to ${currentDate}?`);
    if (!confirmed) return;

    try {
        const response = await fetch(`/food-logs?date=${previousDate}`, {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const previousLogs = await response.json();

        if (!previousLogs.length) {
            alert("No food logs found for the previous day.");
            return;
        }

        for (const log of previousLogs) {
            const copyResponse = await fetch("/food-logs", {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    food_name: log.food_name,
                    calories: log.calories,
                    amount: log.amount,
                    unit: log.unit || "g",
                    meal: log.meal || "snack",
                    log_date: currentDate
                })
            });

            if (!copyResponse.ok) {
                const data = await copyResponse.json().catch(() => ({}));
                alert(data.detail || "Failed to copy one or more food logs.");
                return;
            }
        }

        await loadFoodLogs();
        alert("Food logs copied successfully.");
    } catch (error) {
        console.error("Error copying food logs:", error);
        alert("Something went wrong while copying food logs.");
    }
}

async function copyPreviousExerciseLogs() {
    const previousDate = getPreviousTrackerDateString();
    const currentDate = getCurrentTrackerDateString();

    const confirmed = confirm(`Copy all exercise logs from ${previousDate} to ${currentDate}?`);
    if (!confirmed) return;

    try {
        const response = await fetch(`/exercise-logs?date=${previousDate}`, {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const previousLogs = await response.json();

        if (!previousLogs.length) {
            alert("No exercise logs found for the previous day.");
            return;
        }

        for (const log of previousLogs) {
            const copyResponse = await fetch("/exercise-logs", {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    exercise_name: log.exercise_name,
                    calories_burned: log.calories_burned,
                    hours: log.hours,
                    log_date: currentDate
                })
            });

            if (!copyResponse.ok) {
                const data = await copyResponse.json().catch(() => ({}));
                alert(data.detail || "Failed to copy one or more exercise logs.");
                return;
            }
        }

        await loadExerciseLogs();
        alert("Exercise logs copied successfully.");
    } catch (error) {
        console.error("Error copying exercise logs:", error);
        alert("Something went wrong while copying exercise logs.");
    }
}

async function copyPreviousWaterLogs() {
    const previousDate = getPreviousTrackerDateString();
    const currentDate = getCurrentTrackerDateString();

    const confirmed = confirm(`Copy all water logs from ${previousDate} to ${currentDate}?`);
    if (!confirmed) return;

    try {
        const response = await fetch(`/water-logs?date=${previousDate}`, {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const previousLogs = await response.json();

        if (!previousLogs.length) {
            alert("No water logs found for the previous day.");
            return;
        }

        for (const log of previousLogs) {
            const copyResponse = await fetch("/water-logs", {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    amount_ml: log.amount_ml,
                    log_date: currentDate
                })
            });

            if (!copyResponse.ok) {
                const data = await copyResponse.json().catch(() => ({}));
                alert(data.detail || "Failed to copy one or more water logs.");
                return;
            }
        }

        await loadWaterLogs();
        alert("Water logs copied successfully.");
    } catch (error) {
        console.error("Error copying water logs:", error);
        alert("Something went wrong while copying water logs.");
    }
}

// ---------- Stats page ----------
async function setupStatsPage() {
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

    renderPlot(graphContainer);
}

async function renderPlot(graphContainer=null) {
    if (graphContainer === null) {
        graphContainer = document.getElementById("graph-container");
    }

    let food     = await fetchFoodLogs();
    let exercise = await fetchExerciseLogs();

    let total_timestamps = [];
    let total_calories   = [];

    let fi = 0;
    let ei = 0;
    let total = 0;
    while (fi < food.length || ei < exercise.length) {
        let ft = (fi < food.length)     ? Date.parse(food[fi].created_at)     : new Date(8640000000000000).getTime();
        let et = (ei < exercise.length) ? Date.parse(exercise[ei].created_at) : new Date(8640000000000000).getTime();

        if (ft < et) {
            total += food[fi].calories;
            total_timestamps.push(food[fi].created_at);
            fi += 1;
        }
        else if (et < ft) {
            total -= exercise[ei].calories_burned;
            total_timestamps.push(exercise[ei].created_at);
            ei += 1;
        }
        else if (ft === et) {
            total += food[fi].calories - exercise[ei].calories_burned;
            total_timestamps.push(food[fi].created_at);
            ft += 1;
            ei += 1;
        }
        else {
            break;
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
        width: 550,
        title: {
            text: "Calories Burned/Gained",
        },
        dragmode: "pan",
    }

    let config = {
        scrollZoom: true,
        responsive: true,
        displaylogo: false,
        modeBarButtonsToRemove: [
            "toImage", "zoom2d", "pan2d", "select2d", "lasso2d", "autoScale2d",
        ],
    }

    Plotly.newPlot(graphContainer, data, layout, config);

    let new_dld_btn = document.getElementById("download-graph");
    new_dld_btn.onclick = () => Plotly.downloadImage('graph-container', {filename: `nutri-daily-graph-${formatTrackerDateForApi(trackerSelectedDate)}`});
}

// ---------- Food section ----------
const MEAL_ORDER = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snack"
};

function defaultMealForNow() {
    const h = new Date().getHours();
    if (h >= 5 && h <= 10) return "breakfast";
    if (h >= 11 && h <= 15) return "lunch";
    if (h >= 16 && h <= 21) return "dinner";
    return "snack";
}

function inferMealFromCreatedAt(createdAt) {
    if (!createdAt) return "snack";
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) return "snack";
    const h = d.getHours();
    if (h >= 5 && h <= 10) return "breakfast";
    if (h >= 11 && h <= 15) return "lunch";
    if (h >= 16 && h <= 21) return "dinner";
    return "snack";
}

function mealForLog(log) {
    if (log.meal && MEAL_ORDER.includes(log.meal)) return log.meal;
    return inferMealFromCreatedAt(log.created_at);
}

function unitLabelForFood(food) {
    return food && food.serving_unit === "mL" ? "mL" : "Grams";
}

function unitCodeForFood(food) {
    return food && food.serving_unit === "mL" ? "mL" : "g";
}

function servingSizeOf(food) {
    if (!food) return null;
    return food.serving_size != null ? food.serving_size : food.serving_size_g;
}

function applyFoodUnitToInput(food, inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.placeholder = unitLabelForFood(food);
}

let foodList = [];
let selectedFood = null;
let foodCaloriesTotal = 0;
let exerciseCaloriesTotal = 0;
let waterTotal = 0;

let userGoals = {
    calorie_goal: 2000,
    exercise_goal: 500,
    water_goal_ml: 2000
};

let homeCaloriesConsumedToday = 0;
let homeCaloriesBurnedToday = 0;
let homeWaterTotalToday = 0;

function updateCalorieTotals() {
    const inEl = document.getElementById("calories-in");
    const outEl = document.getElementById("calories-out");
    const totalEl = document.getElementById("total-calories");

    const caloriesIn = Number(foodCaloriesTotal) || 0;
    const caloriesOut = Number(exerciseCaloriesTotal) || 0;
    const netCalories = caloriesIn - caloriesOut;

    if (inEl) inEl.textContent = caloriesIn;
    if (outEl) outEl.textContent = caloriesOut;
    if (totalEl) totalEl.textContent = netCalories;
}

async function loadUserGoals() {
    try {
        const response = await fetch("/settings/goals", {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            userGoals = await response.json();
            updateAllGoalProgress();
            populateGoalSettingsInputs();
        }
    } catch (error) {
        console.error("Error loading user goals:", error);
    }
}

function updateAllGoalProgress() {
    updateGoalProgress(
        "food-goal-label",
        "food-goal-fill",
        foodCaloriesTotal,
        userGoals.calorie_goal,
        "kcal"
    );

    updateGoalProgress(
        "exercise-goal-label",
        "exercise-goal-fill",
        exerciseCaloriesTotal,
        userGoals.exercise_goal,
        "kcal burned"
    );

    updateGoalProgress(
        "water-goal-label",
        "water-goal-fill",
        waterTotal,
        userGoals.water_goal_ml,
        "mL"
    );
}

function updateGoalProgress(labelId, fillId, current, goal, unit) {
    const label = document.getElementById(labelId);
    const fill = document.getElementById(fillId);

    if (!label || !fill) return;

    const safeCurrent = Number(current) || 0;
    const safeGoal = Number(goal) || 1;
    const percent = Math.min((safeCurrent / safeGoal) * 100, 100);

    label.textContent = `${safeCurrent} / ${safeGoal} ${unit}`;
    fill.style.width = `${percent}%`;

    if (safeCurrent >= safeGoal) {
        fill.classList.add("goal-complete");
    } else {
        fill.classList.remove("goal-complete");
    }
}

function populateGoalSettingsInputs() {
    const calorieInput = document.getElementById("settings-calorie-goal");
    const exerciseInput = document.getElementById("settings-exercise-goal");
    const waterInput = document.getElementById("settings-water-goal");

    if (calorieInput) calorieInput.value = userGoals.calorie_goal;
    if (exerciseInput) exerciseInput.value = userGoals.exercise_goal;
    if (waterInput) waterInput.value = userGoals.water_goal_ml;
}

async function loadFoodLogs() {
    let data = await fetchFoodLogs();

    if (data !== null) {
        renderFoodList(data);
    }
}

async function fetchFoodLogs() {
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
        return data;
    } catch (error) {
        console.error("Error fetching food logs:", error);
        return null;
    }
}

function buildFoodListItem(log) {
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
    return li;
}

function renderFoodList(logs) {
    const listElement = document.getElementById("calorie-list");
    const emptyLabel = document.getElementById("food-empty");

    if (!listElement || !emptyLabel) return;

    listElement.innerHTML = "";

    if (logs.length === 0) {
        emptyLabel.style.display = "block";
        foodCaloriesTotal = 0;
        updateCalorieTotals();
        return;
    }

    emptyLabel.style.display = "none";

    const groups = { breakfast: [], lunch: [], dinner: [], snack: [] };
    let total = 0;

    logs.forEach(log => {
        total += log.calories;
        groups[mealForLog(log)].push(log);
    });

    MEAL_ORDER.forEach(meal => {
        const entries = groups[meal];
        if (entries.length === 0) return;

        const groupSubtotal = entries.reduce((sum, log) => sum + log.calories, 0);

        const groupDiv = document.createElement("div");
        groupDiv.className = "meal-group";

        const heading = document.createElement("h3");
        heading.className = "meal-heading";
        heading.textContent = MEAL_LABELS[meal];

        const subtotal = document.createElement("span");
        subtotal.className = "meal-subtotal";
        subtotal.textContent = `${groupSubtotal} kcal`;
        heading.appendChild(subtotal);

        groupDiv.appendChild(heading);

        const ul = document.createElement("ul");
        entries.forEach(log => ul.appendChild(buildFoodListItem(log)));
        groupDiv.appendChild(ul);

        listElement.appendChild(groupDiv);
    });

    foodCaloriesTotal = total;
    updateCalorieTotals();
}

async function openAddFoodModal() {
    const modal = document.getElementById("add-food-modal");
    if (modal) {
        modal.style.display = "block";
    }

    const mealSelect = document.getElementById("food-meal");
    if (mealSelect) mealSelect.value = defaultMealForNow();

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
            applyFoodUnitToInput(f, "food-grams");
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
    const foodMeal = document.getElementById("food-meal");

    if (foodSearch) foodSearch.value = "";
    if (foodGrams) {
        foodGrams.value = "";
        foodGrams.placeholder = "Grams";
    }
    if (foodError) foodError.style.display = "none";
    if (foodResults) {
        foodResults.innerHTML = "";
        foodResults.style.display = "none";
    }
    if (foodMeal) foodMeal.value = "breakfast";

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

    const unitLabel = unitLabelForFood(selectedFood);
    const unitWord = unitLabel.toLowerCase();

    if (!gramsInput) {
        errorEl.textContent = `Please enter the amount in ${unitWord}.`;
        errorEl.style.display = "block";
        return;
    }

    const grams = parseFloat(gramsInput);

    if (isNaN(grams) || grams <= 0) {
        errorEl.textContent = `${unitLabel} must be a positive number.`;
        errorEl.style.display = "block";
        return;
    }

    const decimalParts = gramsInput.split(".");
    if (decimalParts.length === 2 && decimalParts[1].length > 2) {
        errorEl.textContent = `${unitLabel} can have at most 2 decimal places (e.g. 0.25).`;
        errorEl.style.display = "block";
        return;
    }

    const servingSize = servingSizeOf(selectedFood);
    const calories = Math.round((selectedFood.calories / servingSize) * grams);
    const mealSelect = document.getElementById("food-meal");
    const meal = mealSelect && MEAL_ORDER.includes(mealSelect.value) ? mealSelect.value : defaultMealForNow();

    try {
        const response = await fetch("/food-logs", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                food_name: selectedFood.name,
                calories: calories,
                amount: grams,
                unit: unitCodeForFood(selectedFood),
                meal: meal,
                log_date: formatTrackerDateForApi(trackerSelectedDate)
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

    applyFoodUnitToInput(selectedEditFood, "edit-food-grams");

    const existingAmount = log.amount != null ? log.amount : log.grams;
    if (existingAmount != null) {
        gramsInput.value = existingAmount;
    } else if (selectedEditFood) {
        const ss = servingSizeOf(selectedEditFood);
        const derived = (log.calories * ss) / selectedEditFood.calories;
        gramsInput.value = derived.toFixed(2);
    } else {
        gramsInput.value = "";
    }

    const mealSelect = document.getElementById("edit-food-meal");
    if (mealSelect) mealSelect.value = mealForLog(log);
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
            applyFoodUnitToInput(f, "edit-food-grams");
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
    const mealSelect = document.getElementById("edit-food-meal");

    if (searchInput) searchInput.value = "";
    if (gramsInput) {
        gramsInput.value = "";
        gramsInput.placeholder = "Grams";
    }
    if (errorEl) errorEl.style.display = "none";
    if (resultsEl) {
        resultsEl.innerHTML = "";
        resultsEl.style.display = "none";
    }
    if (mealSelect) mealSelect.value = "breakfast";

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

    const unitLabel = unitLabelForFood(selectedEditFood);
    const unitWord = unitLabel.toLowerCase();

    const gramsRaw = gramsInput.value.trim();
    if (!gramsRaw) {
        errorEl.textContent = `Please enter the amount in ${unitWord}.`;
        errorEl.style.display = "block";
        return;
    }

    const grams = parseFloat(gramsRaw);
    if (isNaN(grams) || grams <= 0) {
        errorEl.textContent = `${unitLabel} must be a positive number.`;
        errorEl.style.display = "block";
        return;
    }

    const decimalParts = gramsRaw.split(".");
    if (decimalParts.length === 2 && decimalParts[1].length > 2) {
        errorEl.textContent = `${unitLabel} can have at most 2 decimal places (e.g. 0.25).`;
        errorEl.style.display = "block";
        return;
    }

    const servingSize = servingSizeOf(selectedEditFood);
    const calories = Math.round((selectedEditFood.calories / servingSize) * grams);
    const mealSelect = document.getElementById("edit-food-meal");
    const meal = mealSelect && MEAL_ORDER.includes(mealSelect.value) ? mealSelect.value : mealForLog(foodLogToEdit);

    try {
        const response = await fetch(`/food-logs/${foodLogToEdit.id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                food_name: selectedEditFood.name,
                calories: calories,
                amount: grams,
                unit: unitCodeForFood(selectedEditFood),
                meal: meal
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
    let data = await fetchExerciseLogs();

    if (data !== null) {
        renderExerciseList(data);
    }
}

async function fetchExerciseLogs() {
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
                hours: hours,
                log_date: formatTrackerDateForApi(trackerSelectedDate)
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

// ---------- Water section ----------
async function loadWaterLogs() {
    try {
        const dateParam = formatTrackerDateForApi(trackerSelectedDate);
        const response = await fetch(`/water-logs?date=${dateParam}`, {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();
        renderWaterList(data);
    } catch (error) {
        console.error("Error fetching water logs:", error);
    }
}

function renderWaterList(logs) {
    const listElement = document.getElementById("water-list");
    const emptyLabel = document.getElementById("water-empty");
    const totalLabel = document.getElementById("water-total-label");
    if (!listElement || !emptyLabel) return;

    listElement.innerHTML = "";
    let total = 0;

    if (logs.length === 0) {
        emptyLabel.style.display = "block";
    } else {
        emptyLabel.style.display = "none";
    }

    logs.forEach(log => {
        total += log.amount_ml;

        const li = document.createElement("li");
        li.className = "item water-item";

        const itemInfo = document.createElement("div");
        itemInfo.className = "item-info";

        const strong = document.createElement("strong");
        strong.textContent = "Water";
        itemInfo.appendChild(strong);
        itemInfo.append(` - ${log.amount_ml} mL`);

        li.appendChild(itemInfo);

        const actions = document.createElement("div");
        actions.className = "actions";

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn water-delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => openDeleteWaterModal(log.id);
        actions.appendChild(deleteBtn);

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "Edit";
        editBtn.onclick = () => openEditWaterModal(log);
        actions.appendChild(editBtn);

        li.appendChild(actions);

        listElement.appendChild(li);
    });

    if (totalLabel) totalLabel.textContent = `(${total} mL)`;
}

function openAddWaterModal() {
    const modal = document.getElementById("add-water-modal");
    if (modal) modal.style.display = "block";

    const amountInput = document.getElementById("water-amount");
    if (amountInput) amountInput.focus();
}

function closeAddWaterModal() {
    const modal = document.getElementById("add-water-modal");
    if (modal) modal.style.display = "none";

    const amountInput = document.getElementById("water-amount");
    const errorEl = document.getElementById("water-error");

    if (amountInput) amountInput.value = "";
    if (errorEl) errorEl.style.display = "none";
}

async function addWaterEntry() {
    const amountInput = document.getElementById("water-amount");
    const errorEl = document.getElementById("water-error");

    if (!amountInput || !errorEl) return;
    errorEl.style.display = "none";

    const raw = amountInput.value.trim();
    if (!raw) {
        errorEl.textContent = "Please enter the amount in mL.";
        errorEl.style.display = "block";
        return;
    }

    const amount = parseInt(raw, 10);
    if (isNaN(amount) || amount <= 0) {
        errorEl.textContent = "Amount must be a positive whole number.";
        errorEl.style.display = "block";
        return;
    }

    try {
        const response = await fetch("/water-logs", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                amount_ml: amount,
                log_date: formatTrackerDateForApi(trackerSelectedDate)
            })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            closeAddWaterModal();
            loadWaterLogs();
        } else {
            const data = await response.json().catch(() => ({}));
            errorEl.textContent = data.detail || "Failed to log water.";
            errorEl.style.display = "block";
        }
    } catch (error) {
        console.error("Error logging water:", error);
        errorEl.textContent = "Something went wrong.";
        errorEl.style.display = "block";
    }
}

let waterLogToDelete = null;

function openDeleteWaterModal(logId) {
    waterLogToDelete = logId;
    document.getElementById("delete-water-modal").style.display = "block";
}

function closeDeleteWaterModal() {
    waterLogToDelete = null;
    document.getElementById("delete-water-modal").style.display = "none";
}

async function confirmDeleteWater() {
    if (!waterLogToDelete) {
        closeDeleteWaterModal();
        return;
    }

    try {
        const response = await fetch(`/water-logs/${waterLogToDelete}`, {
            method: "DELETE",
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            closeDeleteWaterModal();
            loadWaterLogs();
        } else {
            const data = await response.json().catch(() => ({}));
            alert(data.detail || "Failed to delete water log.");
            closeDeleteWaterModal();
        }
    } catch (error) {
        console.error("Error deleting water log:", error);
        alert("Something went wrong.");
        closeDeleteWaterModal();
    }
}

let waterLogToEdit = null;

function openEditWaterModal(log) {
    waterLogToEdit = log;

    const modal = document.getElementById("edit-water-modal");
    const amountInput = document.getElementById("edit-water-amount");
    const errorEl = document.getElementById("edit-water-error");

    if (!modal || !amountInput) return;

    if (errorEl) errorEl.style.display = "none";
    amountInput.value = log.amount_ml;

    modal.style.display = "block";
    amountInput.focus();
}

function closeEditWaterModal() {
    const modal = document.getElementById("edit-water-modal");
    if (modal) modal.style.display = "none";

    const amountInput = document.getElementById("edit-water-amount");
    const errorEl = document.getElementById("edit-water-error");

    if (amountInput) amountInput.value = "";
    if (errorEl) errorEl.style.display = "none";

    waterLogToEdit = null;
}

async function saveWaterEdit() {
    const amountInput = document.getElementById("edit-water-amount");
    const errorEl = document.getElementById("edit-water-error");

    if (!amountInput || !errorEl || !waterLogToEdit) return;
    errorEl.style.display = "none";

    const raw = amountInput.value.trim();
    if (!raw) {
        errorEl.textContent = "Please enter the amount in mL.";
        errorEl.style.display = "block";
        return;
    }

    const amount = parseInt(raw, 10);
    if (isNaN(amount) || amount <= 0) {
        errorEl.textContent = "Amount must be a positive whole number.";
        errorEl.style.display = "block";
        return;
    }

    try {
        const response = await fetch(`/water-logs/${waterLogToEdit.id}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify({ amount_ml: amount })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.ok) {
            closeEditWaterModal();
            loadWaterLogs();
        } else {
            const data = await response.json().catch(() => ({}));
            errorEl.textContent = data.detail || "Failed to update water log.";
            errorEl.style.display = "block";
        }
    } catch (error) {
        console.error("Error updating water log:", error);
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

async function adminAddFood() {
    const nameInput = document.getElementById("admin-food-name");
    const caloriesInput = document.getElementById("admin-food-calories");
    const servingSizeInput = document.getElementById("admin-food-serving-size-g");
    const messageEl = document.getElementById("admin-food-message");

    if (!nameInput || !caloriesInput || !servingSizeInput || !messageEl) return;

    const name = nameInput.value.trim();
    const calories = parseInt(caloriesInput.value, 10);
    const serving_size_g = parseFloat(servingSizeInput.value);

    if (!name || isNaN(calories) || calories <= 0 || isNaN(serving_size_g) || serving_size_g <= 0) {
        messageEl.textContent = "Please enter a valid food name, calories, and serving size.";
        messageEl.style.color = "red";
        return;
    }

    try {
        const response = await fetch("/admin/foods", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                name,
                calories,
                serving_size_g
            })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.status === 403) {
            window.location.href = "/tracker";
            return;
        }

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            messageEl.textContent = data.message || "Food added successfully.";
            messageEl.style.color = "green";

            nameInput.value = "";
            caloriesInput.value = "";
            servingSizeInput.value = "100";
        } else {
            messageEl.textContent = data.detail || "Failed to add food.";
            messageEl.style.color = "red";
        }
    } catch (error) {
        console.error("Error adding food:", error);
        messageEl.textContent = "Something went wrong.";
        messageEl.style.color = "red";
    }
}

async function adminAddExercise() {
    const nameInput = document.getElementById("admin-exercise-name");
    const caloriesInput = document.getElementById("admin-exercise-calories");
    const messageEl = document.getElementById("admin-exercise-message");

    if (!nameInput || !caloriesInput || !messageEl) return;

    const name = nameInput.value.trim();
    const calories_per_hour = parseInt(caloriesInput.value, 10);

    if (!name || isNaN(calories_per_hour) || calories_per_hour <= 0) {
        messageEl.textContent = "Please enter a valid exercise name and calories per hour.";
        messageEl.style.color = "red";
        return;
    }

    try {
        const response = await fetch("/admin/exercises", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                name,
                calories_per_hour
            })
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        if (response.status === 403) {
            window.location.href = "/tracker";
            return;
        }

        const data = await response.json().catch(() => ({}));

        if (response.ok) {
            messageEl.textContent = data.message || "Exercise added successfully.";
            messageEl.style.color = "green";

            nameInput.value = "";
            caloriesInput.value = "";
        } else {
            messageEl.textContent = data.detail || "Failed to add exercise.";
            messageEl.style.color = "red";
        }
    } catch (error) {
        console.error("Error adding exercise:", error);
        messageEl.textContent = "Something went wrong.";
        messageEl.style.color = "red";
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
                ${getProfileAvatarHtml(post)}
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
    loadPendingRecapIntoCreatePost();
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
                ${getProfileAvatarHtml(post)}
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
// ---------- Stats page ----------
let latestWeeklyRecap = null;

async function setupWeeklyRecapPage() {
    const canvas = document.getElementById("weekly-recap-canvas");
    if (!canvas) return;

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
    await loadWeeklyRecap();
}

async function loadWeeklyRecap() {
    const messageEl = document.getElementById("weekly-recap-message");

    try {
        const response = await fetch("/weekly-recap", {
            headers: getAuthHeaders(false)
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();

        if (response.ok) {
            latestWeeklyRecap = data;
            drawWeeklyRecapCard(data);

            if (messageEl) {
                messageEl.textContent = "Weekly recap updated.";
                messageEl.style.color = "green";
            }
        } else if (messageEl) {
            messageEl.textContent = data.detail || "Failed to load weekly recap.";
            messageEl.style.color = "red";
        }
    } catch (error) {
        console.error("Error loading weekly recap:", error);
        if (messageEl) {
            messageEl.textContent = "Something went wrong.";
            messageEl.style.color = "red";
        }
    }
}

function drawWeeklyRecapCard(data) {
    const canvas = document.getElementById("weekly-recap-canvas");
    if (!canvas || !data) return;

    const ctx = canvas.getContext("2d");
    const isDarkMode = document.body.classList.contains("dark-mode");

    const colors = isDarkMode
        ? {
            background: "#111827",
            card: "#1f2937",
            statBox: "#111827",
            primary: "#22c55e",
            text: "#f9fafb",
            muted: "#d1d5db",
            footer: "#9ca3af",
            positiveBar: "#22c55e",
            negativeBar: "#38bdf8"
        }
        : {
            background: "#f3f4f6",
            card: "#ffffff",
            statBox: "#f9fafb",
            primary: "#06c206",
            text: "#1f2937",
            muted: "#6b7280",
            footer: "#6b7280",
            positiveBar: "#06c206",
            negativeBar: "#3b82f6"
        };

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = colors.card;
    roundRect(ctx, 80, 80, 920, 920, 40);
    ctx.fill();

    ctx.fillStyle = colors.primary;
    ctx.font = "bold 70px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.fillText("Nutri Weekly Recap", 540, 170);

    ctx.fillStyle = colors.muted;
    ctx.font = "34px Segoe UI, Arial";
    ctx.fillText(`${data.week_start} to ${data.week_end}`, 540, 225);

    drawRecapStat(ctx, "Calories Consumed", data.total_consumed, 210, 310, colors);
    drawRecapStat(ctx, "Calories Burned", data.total_burned, 560, 310, colors);
    drawRecapStat(ctx, "Net Calories", data.net_calories, 210, 520, colors);
    drawRecapStat(ctx, "Days Logged", `${data.days_logged}/7`, 560, 520, colors);

    const maxNet = Math.max(...data.daily.map(day => Math.abs(day.net_calories)), 1);
    const startX = 170;
    const baseY = 820;
    const barWidth = 70;
    const gap = 35;

    ctx.font = "22px Segoe UI, Arial";
    ctx.textAlign = "center";

    data.daily.forEach((day, index) => {
        const x = startX + index * (barWidth + gap);
        const barHeight = Math.max(8, Math.abs(day.net_calories) / maxNet * 150);

        ctx.fillStyle = day.net_calories >= 0 ? colors.positiveBar : colors.negativeBar;
        ctx.fillRect(x, baseY - barHeight, barWidth, barHeight);

        ctx.fillStyle = colors.muted;
        const date = parseLocalDate(day.date);
        const label = date.toLocaleDateString(undefined, { weekday: "short" });
        ctx.fillText(label, x + barWidth / 2, baseY + 40);
    });

    ctx.fillStyle = colors.footer;
    ctx.font = "28px Segoe UI, Arial";
    ctx.fillText("Shared from Nutri", 540, 960);
}

function drawRecapStat(ctx, label, value, x, y, colors) {
    ctx.fillStyle = colors.statBox;
    roundRect(ctx, x, y, 310, 150, 24);
    ctx.fill();

    ctx.fillStyle = colors.muted;
    ctx.font = "26px Segoe UI, Arial";
    ctx.textAlign = "center";
    ctx.fillText(label, x + 155, y + 48);

    ctx.fillStyle = colors.primary;
    ctx.font = "bold 46px Segoe UI, Arial";
    ctx.fillText(String(value), x + 155, y + 105);
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

async function shareWeeklyRecap() {
    const canvas = document.getElementById("weekly-recap-canvas");
    const messageEl = document.getElementById("weekly-recap-message");

    if (!canvas || !latestWeeklyRecap) {
        if (messageEl) {
            messageEl.textContent = "Generate a recap first.";
            messageEl.style.color = "red";
        }
        return;
    }

    const recapImageDataUrl = canvas.toDataURL("image/png");

    const recapCaption = `My Nutri weekly recap: ${latestWeeklyRecap.total_consumed} calories consumed, ${latestWeeklyRecap.total_burned} burned, ${latestWeeklyRecap.days_logged}/7 days logged.`;

    sessionStorage.setItem("pendingRecapImage", recapImageDataUrl);
    sessionStorage.setItem("pendingRecapCaption", recapCaption);

    window.location.href = "/feed/create";
}

function dataUrlToFile(dataUrl, filename) {
    const arr = dataUrl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const bstr = atob(arr[1]);

    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }

    return new File([u8arr], filename, { type: mime });
}

function loadPendingRecapIntoCreatePost() {
    const imageInput = document.getElementById("post-images");
    const captionInput = document.getElementById("post-caption");
    const preview = document.getElementById("post-image-preview");

    if (!imageInput || !captionInput || !preview) return;

    const pendingImage = sessionStorage.getItem("pendingRecapImage");
    const pendingCaption = sessionStorage.getItem("pendingRecapCaption");

    if (!pendingImage) return;

    const recapFile = dataUrlToFile(pendingImage, "weekly-recap.png");

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(recapFile);
    imageInput.files = dataTransfer.files;

    if (pendingCaption) {
        captionInput.value = pendingCaption;
    }

    preview.innerHTML = "";

    const img = document.createElement("img");
    img.src = pendingImage;
    preview.appendChild(img);

    sessionStorage.removeItem("pendingRecapImage");
    sessionStorage.removeItem("pendingRecapCaption");
}

function downloadWeeklyRecap() {
    const canvas = document.getElementById("weekly-recap-canvas");
    const messageEl = document.getElementById("weekly-recap-message");

    if (!canvas || !latestWeeklyRecap) {
        if (messageEl) {
            messageEl.textContent = "Generate a recap first.";
            messageEl.style.color = "red";
        }
        return;
    }

    const link = document.createElement("a");
    link.download = `nutri-weekly-recap-${latestWeeklyRecap.week_end || "latest"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    if (messageEl) {
        messageEl.textContent = "Recap downloaded.";
        messageEl.style.color = "green";
    }
}

function showStatsTab(tabName) {
    const statisticsTab = document.getElementById("statistics-tab");
    const visualizationsTab = document.getElementById("visualizations-tab");
    const tabButtons = document.querySelectorAll(".stats-tab");

    if (!statisticsTab || !visualizationsTab) return;

    statisticsTab.style.display = tabName === "statistics" ? "block" : "none";
    visualizationsTab.style.display = tabName === "visualizations" ? "block" : "none";

    tabButtons.forEach(button => {
        button.classList.remove("active-stats-tab");
    });

    const activeButton = Array.from(tabButtons).find(button =>
        button.textContent.toLowerCase().includes(tabName)
    );

    if (activeButton) {
        activeButton.classList.add("active-stats-tab");
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
    populateProfilePicturePreview(currentUser);

    await loadUserGoals();
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

async function submitProfilePicture() {
    const input = document.getElementById("settings-profile-picture-input");
    const messageEl = document.getElementById("settings-profile-picture-message");

    if (!input || !messageEl) return;

    const file = input.files?.[0];
    if (!file) {
        messageEl.textContent = "Please choose an image.";
        messageEl.style.color = "red";
        return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
        const response = await fetch("/settings/profile-picture", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${getToken()}`
            },
            body: formData
        });

        if (response.status === 401) {
            logoutUser();
            return;
        }

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem("nutriUser", JSON.stringify(data));
            messageEl.textContent = "Profile picture updated successfully.";
            messageEl.style.color = "green";

            renderUserHeader(data);
            populateProfilePicturePreview(data);
            updateHomeProfilePicture(data);
        } else {
            messageEl.textContent = data.detail || "Failed to upload profile picture.";
            messageEl.style.color = "red";
        }
    } catch (error) {
        console.error("Error uploading profile picture:", error);
        messageEl.textContent = "Something went wrong.";
        messageEl.style.color = "red";
    }
}

function updateHomeProfilePicture(user) {
    const homeProfilePictureEl = document.getElementById("home-profile-picture");
    if (!homeProfilePictureEl || !user) return;

    homeProfilePictureEl.innerHTML = getProfileAvatarHtml(user, "avatar-large");
}

function populateProfilePicturePreview(user) {
    const previewContainer = document.getElementById("settings-profile-preview");
    if (!previewContainer || !user) return;

    previewContainer.innerHTML = getProfileAvatarHtml(user, "avatar-large");
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
function getProfileAvatarHtml(user, sizeClass = "") {
    const username = user?.username || "U";
    const firstLetter = username.charAt(0).toUpperCase();
    const profilePicture = user?.profile_picture;

    if (profilePicture) {
        return `
            <img
                src="${profilePicture}"
                alt="${escapeHtml(username)} profile picture"
                class="avatar-image ${sizeClass}"
            >
        `;
    }

    return `
        <div class="avatar-fallback ${sizeClass}">
            ${escapeHtml(firstLetter)}
        </div>
    `;
}

function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split("-").map(Number);
    return new Date(year, month - 1, day);
}