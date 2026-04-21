# CalorieTracker
A website where users can post their calorie intake and outtake, and track their progress over time.

# Main Features
## Login
## Add/Remove Food
## Add/Remove Exercises
## Admin Controls

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
git checkout <my-branch>
git pull
git merge main
git checkout main
git merge <my-branch>
```