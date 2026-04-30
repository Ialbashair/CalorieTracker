# 🍏 Nutri – Full Stack Calorie Tracker & Social App

Nutri is a full-stack web application that combines **calorie tracking**, **fitness logging**, and a **social feed** into one seamless platform. Users can track their nutrition, monitor daily stats, and share their progress with others — all in one place.

---

## 🚀 Features

### 🔐 Authentication & User System

* User registration & login (JWT-based authentication)
* Role-based access (Admin vs Regular User)
* Secure password hashing
* Persistent login with token storage

### 🏠 Home Dashboard

* Personalized landing page after login
* Displays:

  * Calories Consumed Today
  * Calories Burned Today
  * Net Calories
* Profile preview and quick navigation

### 🍽️ Calorie & Exercise Tracker

* Log food entries with calorie values
* Log exercise entries with calories burned
* Edit and delete entries
* Daily tracking tied to user account

### 📊 Stats Framework (In Progress)

* Placeholder for future data visualizations
* Designed for chart export + sharing to feed

### 📸 Social Feed

* Instagram-style vertical feed
* Create posts with:

  * 1–5 images
  * Custom captions
* Features:

  * Image carousel per post
  * Like system (1 like per user per post)
  * Infinite scrolling
* Profile page shows only your posts + stats

### 👤 Profile System

* View personal posts
* Track total likes
* Manage posts (edit/delete)

### 🛠️ Admin Panel

* View all users
* Search users
* Edit user roles (admin/user)
* Delete users

### ⚙️ Settings Page

* Update username
* Change password
* Upload profile picture
* Toggle dark mode

### 🌙 Dark Mode

* Full app-wide theme toggle
* Styled across all pages

---

## 🧱 Tech Stack

**Frontend**

* HTML, CSS, JavaScript (Vanilla)
* Responsive UI with custom styling

**Backend**

* FastAPI (Python)
* MongoDB (via PyMongo)

**Other**

* JWT Authentication
* File uploads (images for posts & profile pictures)
* Uvicorn server

---

## 📁 Project Structure (Simplified)

```
/static
  ├── index.html (tracker)
  ├── home.html
  ├── feed.html
  ├── profile.html
  ├── admin.html
  ├── settings.html
  ├── style.css
  ├── script.js
  └── uploads/

/main.py
/requirements.txt
```

---

## 🧪 How to Run Locally

1. Clone the repo:

```
git clone https://github.com/Ialbashair/CalorieTracker.git
cd CalorieTracker
```

2. Create a virtual environment:

```
python -m venv venv
source venv/bin/activate   # or venv\Scripts\activate on Windows
```

3. Install dependencies:

```
pip install -r requirements.txt
```

4. Run the server:

```
uvicorn main:app --reload
```

5. Open in browser:

```
http://127.0.0.1:8000
```

---

## ⭐ Summary

Nutri is more than a tracker — it’s a **fitness + social platform** that lets users:

* Track their habits
* Visualize their progress
* Share their journey

---
