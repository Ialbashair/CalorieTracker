# ---------- Imports ----------
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from typing import List, Optional
from pymongo import MongoClient
from passlib.context import CryptContext

# ---------- Initialize app ----------
app = FastAPI()

# Debug print to confirm the correct file is running
print("MAIN.PY LOADED", flush=True)

# ---------- MongoDB setup ----------
class MongoDBSettings(BaseSettings):
    url: str = ""

    model_config = SettingsConfigDict(env_file="./.env")

MONGO_URL = MongoDBSettings().url

client = MongoClient(MONGO_URL)
database = client["Nutri"]

# Collections
users_collection = database["User_Info"]
foods_collection = database["Foods"]
food_logs_collection = database["Food_logs"]
exercises_collection = database["Exercises"]
exercise_logs_collection = database["Exercise_logs"]

print("Connected to database:", database.name, flush=True)
print("Users collection:", users_collection.name, flush=True)
print("Foods collection:", foods_collection.name, flush=True)
print("Food logs collection:", food_logs_collection.name, flush=True)

# ---------- Password hashing ----------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    print("hash_password() called", flush=True)
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    print("verify_password() called", flush=True)
    return pwd_context.verify(plain_password, hashed_password)

# ---------- Pydantic models ----------
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: str
    username: str
    email: str
    role: str

class FoodLog(BaseModel):
    id: Optional[str] = None
    user_id: str
    food_name: str
    calories: int

class ExerciseLog(BaseModel):
    id: Optional[str] = None
    user_id: str
    exercise_name: str
    calories_burned: int

# ---------- Helper functions ----------
def serialize_user(user) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user["role"]
    }

# ---------- Auth routes ----------
@app.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate):
    existing_email = users_collection.find_one({"email": user.email})
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = users_collection.find_one({"username": user.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    user_dict = {
        "username": user.username,
        "email": user.email,
        "password": hash_password(user.password),
        "role": "user"
    }

    result = users_collection.insert_one(user_dict)
    new_user = users_collection.find_one({"_id": result.inserted_id})

    if not new_user:
        raise HTTPException(status_code=500, detail="User registration failed")

    return serialize_user(new_user)


@app.post("/login")
def login_user(user: UserLogin):
    print("LOGIN ROUTE HIT", flush=True)
    print("Incoming login payload:", user.model_dump(), flush=True)

    try:
        existing_user = users_collection.find_one({"email": user.email})
        print("Login email lookup complete", flush=True)

        if not existing_user:
            print("No user found for that email", flush=True)
            raise HTTPException(status_code=401, detail="Invalid email or password")

        password_ok = verify_password(user.password, existing_user["password"])
        print("Password verification result:", password_ok, flush=True)

        if not password_ok:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        print("Login successful", flush=True)
        return {
            "message": "Login successful",
            "user": serialize_user(existing_user)
        }

    except HTTPException:
        raise
    except Exception as e:
        print("LOGIN ERROR:", repr(e), flush=True)
        raise HTTPException(status_code=500, detail=f"Login failed: {repr(e)}")


# ---------- Food routes ----------
@app.get("/foods")
def get_foods():
    foods = foods_collection.find({}, {"_id": 0, "name": 1, "calories": 1, "serving_size_g": 1})
    return [
        {
            "name": f["name"],
            "calories": f["calories"],
            "serving_size_g": f["serving_size_g"]
        }
        for f in foods
    ]

@app.get("/food-logs/{user_id}", response_model=List[FoodLog])
def get_food_logs(user_id: str):
    logs = food_logs_collection.find({"user_id": user_id})
    return [
        {
            "id": str(log["_id"]),
            "user_id": log["user_id"],
            "food_name": log["food_name"],
            "calories": log["calories"]
        }
        for log in logs
    ]

@app.post("/food-logs", response_model=FoodLog, status_code=status.HTTP_201_CREATED)
def add_food_log(log: FoodLog):
    log_dict = {
        "user_id": log.user_id,
        "food_name": log.food_name,
        "calories": log.calories
    }
    result = food_logs_collection.insert_one(log_dict)
    new_log = food_logs_collection.find_one({"_id": result.inserted_id})
    return {
        "id": str(new_log["_id"]),
        "user_id": new_log["user_id"],
        "food_name": new_log["food_name"],
        "calories": new_log["calories"]
    }

# ---------- Exercise routes ----------
@app.get("/exercises")
def get_exercises():
    exercises = exercises_collection.find({}, {"_id": 0, "name": 1, "calories_per_hour": 1})
    return [{"name": e["name"], "calories_per_hour": e["calories_per_hour"]} for e in exercises]

@app.get("/exercise-logs/{user_id}", response_model=List[ExerciseLog])
def get_exercise_logs(user_id: str):
    logs = exercise_logs_collection.find({"user_id": user_id})
    return [
        {
            "id": str(log["_id"]),
            "user_id": log["user_id"],
            "exercise_name": log["exercise_name"],
            "calories_burned": log["calories_burned"]
        }
        for log in logs
    ]

@app.post("/exercise-logs", response_model=ExerciseLog, status_code=status.HTTP_201_CREATED)
def add_exercise_log(log: ExerciseLog):
    log_dict = {
        "user_id": log.user_id,
        "exercise_name": log.exercise_name,
        "calories_burned": log.calories_burned
    }
    result = exercise_logs_collection.insert_one(log_dict)
    new_log = exercise_logs_collection.find_one({"_id": result.inserted_id})
    return {
        "id": str(new_log["_id"]),
        "user_id": new_log["user_id"],
        "exercise_name": new_log["exercise_name"],
        "calories_burned": new_log["calories_burned"]
    }

# ---------- Static assets ----------
app.mount("/static", StaticFiles(directory="static"), name="static")

# ---------- Page routes ----------
@app.get("/")
def root():
    print("GET / hit -> redirecting to /login", flush=True)
    return RedirectResponse(url="/login")

@app.get("/register")
def register_page():
    print("GET /register page route hit", flush=True)
    return FileResponse("static/register.html")

@app.get("/login")
def login_page():
    print("GET /login page route hit", flush=True)
    return FileResponse("static/login.html")

@app.get("/tracker")
def tracker_page():
    print("GET /tracker page route hit", flush=True)
    return FileResponse("static/index.html")
