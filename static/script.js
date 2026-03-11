const API_URL = "/entries";

window.onload = () => {
    console.log("js loaded");
    loadCalories();
};

async function loadCalories() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        renderList(data);
    } catch (error) {
        console.error("Error fetching data:", error);
    }
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
            nameInput.value = "";
            calInput.value = "";
            loadCalories(); // refresh
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
            loadCalories(); // refresh
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

function renderList(entries) {
    const listElement = document.getElementById("calorie-list");
    const totalDisplay = document.getElementById("total-calories");
    
    listElement.innerHTML = "";
    let total = 0;

    entries.forEach(item => {
        total += item.calories;
        
        const li = document.createElement("li");
        li.className = "item";
        li.innerHTML = `
            <div class="item-info">
                <strong>${item.food_name}</strong> - ${item.calories} kcal
            </div>
            <div class="actions">
                <button class="edit-btn" onclick="openEditModal(${item.id}, '${item.food_name}', ${item.calories})">Edit</button>
                <button class="delete-btn" onclick="openDeleteModal(${item.id})">Delete</button>
            </div>
        `;
        listElement.appendChild(li);
    });

    totalDisplay.innerText = total;
}