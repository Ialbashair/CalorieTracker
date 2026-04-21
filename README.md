# CalorieTracker
A website where users can post their calorie intake and outtake, track their progress over time, and see the progress that other users have uploaded.

# Main Features
## Login
Users can log in and out of the website using an email, username, and password.
TODO: Add image
## Add/Remove Food
TODO: Add good description/image
## Add/Remove Exercises
TODO: Add good description/image
## Visualize Progress
TODO: Add good description/image
## Exercise Social Feed
TODO: Add good description/image
## Admin Controls
Admin users can modify or remove user accounts.
TODO: Add image

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