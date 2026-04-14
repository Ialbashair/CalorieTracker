const API_URL = "/entries";
const REGISTER_URL = "/register";
const LOGIN_URL = "/login";

// Run the correct setup depending on which page is open
window.onload = () => {
    setupRegisterForm();
    setupLoginForm();
    setupCaloriePage();
};

// ---------- Register ----------
function setupRegisterForm() {
    const registerForm = document.getElementById("register-form");
    if (!registerForm) return;

    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document.getElementById("register-username").value.trim();
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value.trim();
        const message = document.getElementById("register-message");

        try {
            const response = await fetch(REGISTER_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username,
                    email,
                    password
                })
            });

            const data = await response.json();

            if (response.ok) {
                message.textContent = "Registration successful. Redirecting to login...";
                message.style.color = "green";

                setTimeout(() => {
                    window.location.href = "/static/login.html";
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

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value.trim();
        const message = document.getElementById("login-message");

        try {
            const response = await fetch(LOGIN_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    password
                })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem("nutriUser", JSON.stringify(data.user));

                message.textContent = "Login successful. Redirecting...";
                message.style.color = "green";

                setTimeout(() => {
                    window.location.href = "/";
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

// ---------- Main calorie tracker page ----------
function setupCaloriePage() {
    const calorieList = document.getElementById("calorie-list");
    if (!calorieList) return;

    const currentUser = getCurrentUser();

    // If not logged in, send user to login page
    if (!currentUser) {
        window.location.href = "/static/login.html";
        return;
    }

    renderUserHeader(currentUser);
    loadCalories();
}

function getCurrentUser() {
    const userData = localStorage.getItem("nutriUser");
    return userData ? JSON.parse(userData) : null;
}

function logoutUser() {
    localStorage.removeItem("nutriUser");
    window.location.href = "/static/login.html";
}

function renderUserHeader(user) {
    const header = document.querySelector("header");
    if (!header) return;

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

    userBar.innerHTML = `
        <span>Logged in as <strong>${user.username}</strong></span>
        <button onclick="logoutUser()">Logout</button>
    `;
}

async function loadCalories() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        renderList(data);
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

function openAddFoodModal() {
    document.getElementById("add-food-modal").style.display = "block";
    document.getElementById("food-name").focus();
}

function closeAddFoodModal() {
    document.getElementById("add-food-modal").style.display = "none";
    document.getElementById("food-name").value = "";
    document.getElementById("calories").value = "";
}

async function addEntry() {
    const nameInput = document.getElementById("food-name");
    const calInput = document.getElementById("calories");

    const newEntry = {
        food_name: nameInput.value,
        calories: parseInt(calInput.value)
    };

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newEntry)
        });

        if (response.ok) {
            closeAddFoodModal();
            loadCalories();
            nameInput.value = "";
            calInput.value = "";
            loadCalories();
        }
    } catch (error) {
        console.error("Error adding entry:", error);
    }
}

function openDeleteModal(id) {
    document.getElementById("delete-id").value = id;
    document.getElementById("delete-modal").style.display = "block";
}

function closeDeleteModal() {
    document.getElementById("delete-modal").style.display = "none";
}

async function confirmDelete() {
    const id = document.getElementById("delete-id").value;

    try {
        const res = await fetch(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        if (res.ok) {
            closeDeleteModal();
            loadCalories();
        }
    } catch (error) {
        console.error("Delete failed:", error);
    }
}

function openEditModal(id, name, calories) {
    document.getElementById("edit-id").value = id;
    document.getElementById("edit-food-name").value = name;
    document.getElementById("edit-calories").value = calories;
    document.getElementById("edit-modal").style.display = "block";
}

function closeModal() {
    document.getElementById("edit-modal").style.display = "none";
}

async function saveEdit() {
    const id = document.getElementById("edit-id").value;
    const name = document.getElementById("edit-food-name").value;
    const calories = document.getElementById("edit-calories").value;

    const updatedData = {
        food_name: name,
        calories: parseInt(calories)
    };

    try {
        const response = await fetch(`${API_URL}/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedData)
        });

        if (response.ok) {
            closeModal();
            loadCalories();
        }
    } catch (error) {
        console.error("Error updating entry:", error);
    }
}

function openDeleteModal(id) {
    document.getElementById("delete-id").value = id;
    document.getElementById("delete-modal").style.display = "block";
}

function closeDeleteModal() {
    document.getElementById("delete-modal").style.display = "none";
}

async function confirmDelete() {
    const id = document.getElementById("delete-id").value;

    try {
        const res = await fetch(`${API_URL}/${id}`, {
            method: "DELETE"
        });

        if (res.ok) {
            closeDeleteModal();
            loadCalories();
        }
    } catch (error) {
        console.error("Delete failed:", error);
    }
}

function renderList(entries) {
    const listElement = document.getElementById("calorie-list");
    const totalDisplay = document.getElementById("total-calories");

    const emptyLabel = document.getElementById("food-empty");

    listElement.innerHTML = "";
    let total = 0;

    if (entries.length === 0) {
        emptyLabel.style.display = "block";
    } else {
        emptyLabel.style.display = "none";
    }

    entries.forEach(item => {
        total += item.calories;

        const li = document.createElement("li");
        li.className = "item";

        const itemInfo = document.createElement("div");
        itemInfo.className = "item-info";
        const strong = document.createElement("strong");
        strong.textContent = item.food_name;
        itemInfo.appendChild(strong);
        itemInfo.append(` - ${item.calories} kcal`);

        const actions = document.createElement("div");
        actions.className = "actions";

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.textContent = "Edit";
        editBtn.onclick = () => openEditModal(item.id, item.food_name, item.calories);

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "Delete";
        deleteBtn.onclick = () => openDeleteModal(item.id);

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        li.appendChild(itemInfo);
        li.appendChild(actions);
        listElement.appendChild(li);
    });

    totalDisplay.innerText = total;
}

// ---- Exercise Section ----

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

function openAddExerciseModal() {
    document.getElementById("add-exercise-modal").style.display = "block";
}

function closeAddExerciseModal() {
    document.getElementById("add-exercise-modal").style.display = "none";
    document.getElementById("exercise-search").value = "";
    document.getElementById("exercise-hours").value = "";
    document.getElementById("exercise-error").style.display = "none";
}

function addExerciseEntry() {
    const search = document.getElementById("exercise-search").value.trim();
    const hoursInput = document.getElementById("exercise-hours").value.trim();
    const errorEl = document.getElementById("exercise-error");

    errorEl.style.display = "none";

    if (!search) {
        errorEl.textContent = "Please enter an exercise name.";
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

    // TODO: Implement once exercise database is connected
}
