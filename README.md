# CalorieTracker 
## HTML
- A simple single-page application (SPA)model
- Designed for basic CRUD functionality
- Using an HTML Form
```
<body>
    <div class="container">
        <header>
            <h1>Calorie Tracker</h1>            
        </header>
        <div class="summery-card">
            <h2>Total Calories: <span id="total-calories">0</span> kcal</h2>            
        </div>
        <section class="form-section">
            <form id="calorie-form">
                <input type="text" id="food-name" placeholder="Food Name" required>
                <input type="number" id="calories" placeholder="Calories" required>
                <button type="submit" id="add-button">Add</button>
            </form>
        </section>

        <section class="list-section">
            <ul id="calorie-list"></ul>    
        </section>        
    </div>
</body>
```

## CSS
- Simple and clean
- Functional and resizable

## JavaScript
- Using FastAPI
- Using Fetch

# Technical Details
## Installation (Windows)
First, navigate to the desired folder in File Explorer, right click and select "open in terminal".
Then, use the command:
```
git clone https://github.com/Ialbashair/CalorieTracker.git
```
Then open the newly created CalorieTracker folder in vscode and enter the following in the terminal:
```
py -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
```
## Running from Terminal
While venv is active:
```
uvicorn main:app
```
## Merging Branches
This contains any weird errors to the sub branch rather than pushing it to main.
```
git pull
git checkout <my-branch>
git merge main
git checkout main
git merge <my-branch>
```