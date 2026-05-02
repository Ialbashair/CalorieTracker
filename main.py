# ---------- Imports ----------
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status, UploadFile, File, Form, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from pymongo import MongoClient
from bson import ObjectId
import os
import shutil
import logging
from logging.handlers import RotatingFileHandler
from uuid import uuid4

# Initiates app
app = FastAPI()

# ---------- Logging setup ----------
LOG_DIR = "logs"
os.makedirs(LOG_DIR, exist_ok=True)

logger = logging.getLogger("nutri")
logger.setLevel(logging.INFO)

log_formatter = logging.Formatter(
    "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)

file_handler = RotatingFileHandler(
    os.path.join(LOG_DIR, "nutri.log"),
    maxBytes=1_000_000,
    backupCount=5
)
file_handler.setFormatter(log_formatter)
file_handler.setLevel(logging.INFO)

console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)
console_handler.setLevel(logging.INFO)

if not logger.handlers:
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

# Creates an uploads folder
UPLOAD_DIR = "static/uploads/posts"
os.makedirs(UPLOAD_DIR, exist_ok=True)
USER_UPLOAD_DIR = "static/uploads/profile_pictures"
os.makedirs(USER_UPLOAD_DIR, exist_ok=True)

# ---------- Settings ----------
class AppSettings(BaseSettings):
    mongo_url: str = ""
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(env_file="./.env")


settings = AppSettings()

# ---------- MongoDB setup ----------
client = MongoClient(settings.mongo_url)
database = client["Nutri"]

users_collection = database["User_Info"]
foods_collection = database["Foods"]
food_logs_collection = database["Food_logs"]
food_logs_archive_collection = database["Food_logs_archive"]
exercises_collection = database["Exercises"]
exercise_logs_collection = database["Exercise_logs"]
posts_collection = database["Posts"]
exercise_logs_archive_collection = database["Exercise_logs_archive"]
water_logs_collection = database["Water_logs"]
water_logs_archive_collection = database["Water_logs_archive"]

# ---------- Security ----------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user_id,
        "exp": expire
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        if not ObjectId.is_valid(user_id):
            raise HTTPException(status_code=401, detail="Invalid user ID in token")

        user = users_collection.find_one({"_id": ObjectId(user_id)})

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_admin(current_user=Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


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
    created_at: Optional[str] = None
    profile_picture: Optional[str] = None


class UserRoleUpdate(BaseModel):
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


VALID_MEALS = {"breakfast", "lunch", "dinner", "snack"}
VALID_FOOD_UNITS = {"g", "mL"}


class FoodLog(BaseModel):
    id: Optional[str] = None
    user_id: str
    food_name: str
    calories: int
    amount: Optional[float] = None
    unit: Optional[str] = None
    meal: Optional[str] = None
    created_at: Optional[str] = None


class FoodLogCreate(BaseModel):
    food_name: str
    calories: int
    amount: Optional[float] = None
    unit: Optional[str] = None
    meal: Optional[str] = None
    log_date: Optional[str] = None


class FoodLogUpdate(BaseModel):
    food_name: str
    calories: int
    amount: Optional[float] = None
    unit: Optional[str] = None
    meal: Optional[str] = None


class ExerciseLog(BaseModel):
    id: Optional[str] = None
    user_id: str
    exercise_name: str
    calories_burned: int
    hours: Optional[float] = None
    created_at: Optional[str] = None


class ExerciseLogCreate(BaseModel):
    exercise_name: str
    calories_burned: int
    hours: Optional[float] = None
    log_date: Optional[str] = None


class ExerciseLogUpdate(BaseModel):
    exercise_name: str
    calories_burned: int
    hours: Optional[float] = None


class WaterLog(BaseModel):
    id: Optional[str] = None
    user_id: str
    amount_ml: int
    created_at: Optional[str] = None


class WaterLogCreate(BaseModel):
    amount_ml: int
    log_date: Optional[str] = None


class WaterLogUpdate(BaseModel):
    amount_ml: int


class UserSummary(BaseModel):
    id: str
    username: str
    email: str
    role: str

class PostOut(BaseModel):
    id: str
    user_id: str
    username: str
    profile_picture: Optional[str] = None
    caption: str
    images: List[str]
    likes: int
    liked_by: List[str]
    created_at: Optional[str] = None

class PostUpdate(BaseModel):
    caption: str

class ProfileStats(BaseModel):
    post_count: int
    total_likes: int

class UsernameUpdate(BaseModel):
    new_username: str

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class UserGoals(BaseModel):
    calorie_goal: int = 2000
    exercise_goal: int = 500
    water_goal_ml: int = 2000


class UserGoalsUpdate(BaseModel):
    calorie_goal: int
    exercise_goal: int
    water_goal_ml: int

class HomeTodayStats(BaseModel):
    calories_consumed_today: int
    calories_burned_today: int
    net_calories_today: int

class WeeklyRecapDay(BaseModel):
    date: str
    calories_consumed: int
    calories_burned: int
    net_calories: int
    food_logs: int
    exercise_logs: int


class WeeklyRecapOut(BaseModel):
    week_start: str
    week_end: str
    total_consumed: int
    total_burned: int
    net_calories: int
    days_logged: int
    daily: List[WeeklyRecapDay]

# ---------- Helper functions ----------
def serialize_user(user) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "created_at": user["created_at"].isoformat() if "created_at" in user and user["created_at"] else None,
        "profile_picture": user.get("profile_picture")
    }

def serialize_goals(user) -> dict:
    return {
        "calorie_goal": user.get("calorie_goal", 2000),
        "exercise_goal": user.get("exercise_goal", 500),
        "water_goal_ml": user.get("water_goal_ml", 2000)
    }


def day_range_utc(date_str: str) -> tuple[datetime, datetime]:
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)

def created_at_for_log_date(log_date: Optional[str]) -> datetime:
    if not log_date:
        return datetime.now(timezone.utc)

    start, _ = day_range_utc(log_date)

    # Store at noon UTC so it safely lands inside the selected date bucket
    return start + timedelta(hours=12)


def serialize_food_log(log) -> dict:
    return {
        "id": str(log["_id"]),
        "user_id": log["user_id"],
        "food_name": log["food_name"],
        "calories": log["calories"],
        "amount": log.get("amount", log.get("grams")),
        "unit": log.get("unit", "g"),
        "meal": log.get("meal"),
        "created_at": log["created_at"].isoformat() if "created_at" in log and log["created_at"] else None
    }


def serialize_exercise_log(log) -> dict:
    return {
        "id": str(log["_id"]),
        "user_id": log["user_id"],
        "exercise_name": log["exercise_name"],
        "calories_burned": log["calories_burned"],
        "hours": log.get("hours"),
        "created_at": log["created_at"].isoformat() if "created_at" in log and log["created_at"] else None
    }


def serialize_water_log(log) -> dict:
    return {
        "id": str(log["_id"]),
        "user_id": log["user_id"],
        "amount_ml": log["amount_ml"],
        "created_at": log["created_at"].isoformat() if "created_at" in log and log["created_at"] else None
    }

def serialize_post(post) -> dict:
    return {
        "id": str(post["_id"]),
        "user_id": post["user_id"],
        "username": post["username"],
        "profile_picture": post.get("profile_picture"),
        "caption": post["caption"],
        "images": post["images"],
        "likes": post.get("likes", 0),
        "liked_by": post.get("liked_by", []),
        "created_at": post["created_at"].isoformat() if "created_at" in post and post["created_at"] else None
    }

# ---------- Auth routes ----------
@app.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate):
    existing_email = users_collection.find_one({"email": user.email})
    if existing_email:
        logger.warning("Registration failed: email already registered email=%s", user.email)
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = users_collection.find_one({"username": user.username})
    if existing_username:
        logger.warning("Registration failed: username already taken username=%s", user.username)
        raise HTTPException(status_code=400, detail="Username already taken")

    user_dict = {
        "username": user.username,
        "email": user.email,
        "password": hash_password(user.password),
        "role": "user",
        "created_at": datetime.now(timezone.utc),
        "calorie_goal": 2000,
        "exercise_goal": 500,
        "water_goal_ml": 2000
    }

    result = users_collection.insert_one(user_dict)
    new_user = users_collection.find_one({"_id": result.inserted_id})

    if not new_user:
        logger.error("User registration failed after insert: email=%s username=%s", user.email, user.username)
        raise HTTPException(status_code=500, detail="User registration failed")

    logger.info("New user registered: user_id=%s email=%s username=%s", str(new_user["_id"]), user.email, user.username)

    return serialize_user(new_user)


@app.post("/login", response_model=TokenResponse)
def login_user(user: UserLogin):
    existing_user = users_collection.find_one({"email": user.email})

    if not existing_user:
        logger.warning("Login failed: user not found email=%s", user.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(user.password, existing_user["password"]):
        logger.warning("Login failed: incorrect password email=%s", user.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(str(existing_user["_id"]))

    logger.info("User logged in: user_id=%s email=%s", str(existing_user["_id"]), user.email)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": serialize_user(existing_user)
    }


@app.get("/me", response_model=UserOut)
def get_me(current_user=Depends(get_current_user)):
    return serialize_user(current_user)


# ---------- Food routes ----------
@app.get("/foods")
def get_foods(current_user=Depends(get_current_user)):
    foods = foods_collection.find(
        {},
        {"_id": 0, "name": 1, "calories": 1, "serving_size_g": 1, "serving_size": 1, "serving_unit": 1, "category": 1}
    )
    return [
        {
            "name": f["name"],
            "calories": f["calories"],
            "serving_size": f.get("serving_size", f.get("serving_size_g")),
            "serving_unit": f.get("serving_unit", "g"),
            "category": f.get("category", "food"),
        }
        for f in foods
    ]


@app.get("/food-logs", response_model=List[FoodLog])
def get_food_logs(date: Optional[str] = None, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    query = {"user_id": user_id}

    if date:
        start, end = day_range_utc(date)
        query["created_at"] = {"$gte": start, "$lt": end}

    logs = food_logs_collection.find(query)
    return [serialize_food_log(log) for log in logs]


@app.post("/food-logs", response_model=FoodLog, status_code=status.HTTP_201_CREATED)
def add_food_log(log: FoodLogCreate, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    if log.meal is not None and log.meal not in VALID_MEALS:
        raise HTTPException(status_code=400, detail="Meal must be breakfast, lunch, dinner, or snack")

    if log.unit is not None and log.unit not in VALID_FOOD_UNITS:
        raise HTTPException(status_code=400, detail="Unit must be 'g' or 'mL'")

    log_dict = {
        "user_id": user_id,
        "food_name": log.food_name,
        "calories": log.calories,
        "amount": log.amount,
        "unit": log.unit or "g",
        "meal": log.meal,
        "created_at": created_at_for_log_date(log.log_date)
    }

    result = food_logs_collection.insert_one(log_dict)
    new_log = food_logs_collection.find_one({"_id": result.inserted_id})

    if not new_log:
        logger.error("Food log creation failed: user_id=%s food=%s", user_id, log.food_name)
        raise HTTPException(status_code=500, detail="Food log creation failed")

    logger.info(
        "Food log added: user_id=%s log_id=%s food=%s calories=%s amount=%s unit=%s log_date=%s",
        user_id,
        str(new_log["_id"]),
        log.food_name,
        log.calories,
        log.amount,
        log.unit,
        log.log_date
    )

    return serialize_food_log(new_log)


@app.put("/food-logs/{log_id}", response_model=FoodLog)
def update_food_log(log_id: str, log: FoodLogUpdate, current_user=Depends(get_current_user)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid food log ID")

    user_id = str(current_user["_id"])

    if log.meal is not None and log.meal not in VALID_MEALS:
        raise HTTPException(status_code=400, detail="Meal must be breakfast, lunch, dinner, or snack")

    if log.unit is not None and log.unit not in VALID_FOOD_UNITS:
        raise HTTPException(status_code=400, detail="Unit must be 'g' or 'mL'")

    existing = food_logs_collection.find_one({"_id": ObjectId(log_id), "user_id": user_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Food log not found")

    food_logs_collection.update_one(
        {"_id": ObjectId(log_id)},
        {
            "$set": {
                "food_name": log.food_name,
                "calories": log.calories,
                "amount": log.amount,
                "unit": log.unit or "g",
                "meal": log.meal
            },
            "$unset": {"grams": ""}
        }
    )

    updated = food_logs_collection.find_one({"_id": ObjectId(log_id)})

    logger.info(
        "Food log updated: user_id=%s log_id=%s food=%s calories=%s amount=%s unit=%s",
        user_id,
        log_id,
        log.food_name,
        log.calories,
        log.amount,
        log.unit
    )

    return serialize_food_log(updated)


@app.delete("/food-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_food_log(log_id: str, current_user=Depends(get_current_user)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid food log ID")

    user_id = str(current_user["_id"])
    log = food_logs_collection.find_one({"_id": ObjectId(log_id), "user_id": user_id})

    if not log:
        raise HTTPException(status_code=404, detail="Food log not found")

    food_logs_archive_collection.insert_one(log)
    food_logs_collection.delete_one({"_id": ObjectId(log_id)})

    logger.info("Food log archived: user_id=%s log_id=%s", user_id, log_id)

    return


# ---------- Exercise routes ----------
@app.get("/exercises")
def get_exercises(current_user=Depends(get_current_user)):
    exercises = exercises_collection.find({}, {"_id": 0, "name": 1, "calories_per_hour": 1})
    return [{"name": e["name"], "calories_per_hour": e["calories_per_hour"]} for e in exercises]


@app.get("/exercise-logs", response_model=List[ExerciseLog])
def get_exercise_logs(date: Optional[str] = None, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    query = {"user_id": user_id}

    if date:
        start, end = day_range_utc(date)
        query["created_at"] = {"$gte": start, "$lt": end}

    logs = exercise_logs_collection.find(query)
    return [serialize_exercise_log(log) for log in logs]


@app.post("/exercise-logs", response_model=ExerciseLog, status_code=status.HTTP_201_CREATED)
def add_exercise_log(log: ExerciseLogCreate, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    log_dict = {
        "user_id": user_id,
        "exercise_name": log.exercise_name,
        "calories_burned": log.calories_burned,
        "hours": log.hours,
        "created_at": created_at_for_log_date(log.log_date)
    }

    result = exercise_logs_collection.insert_one(log_dict)
    new_log = exercise_logs_collection.find_one({"_id": result.inserted_id})

    if not new_log:
        logger.error("Exercise log creation failed: user_id=%s exercise=%s", user_id, log.exercise_name)
        raise HTTPException(status_code=500, detail="Exercise log creation failed")

    logger.info(
        "Exercise log added: user_id=%s log_id=%s exercise=%s calories_burned=%s hours=%s log_date=%s",
        user_id,
        str(new_log["_id"]),
        log.exercise_name,
        log.calories_burned,
        log.hours,
        log.log_date
    )

    return serialize_exercise_log(new_log)


@app.put("/exercise-logs/{log_id}", response_model=ExerciseLog)
def update_exercise_log(log_id: str, log: ExerciseLogUpdate, current_user=Depends(get_current_user)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid exercise log ID")

    user_id = str(current_user["_id"])
    existing = exercise_logs_collection.find_one({"_id": ObjectId(log_id), "user_id": user_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Exercise log not found")

    exercise_logs_collection.update_one(
        {"_id": ObjectId(log_id)},
        {"$set": {
            "exercise_name": log.exercise_name,
            "calories_burned": log.calories_burned,
            "hours": log.hours
        }}
    )

    updated = exercise_logs_collection.find_one({"_id": ObjectId(log_id)})

    logger.info(
        "Exercise log updated: user_id=%s log_id=%s exercise=%s calories_burned=%s hours=%s",
        user_id,
        log_id,
        log.exercise_name,
        log.calories_burned,
        log.hours
    )

    return serialize_exercise_log(updated)


# ---------- Water routes ----------
@app.get("/water-logs", response_model=List[WaterLog])
def get_water_logs(date: Optional[str] = None, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    query = {"user_id": user_id}

    if date:
        start, end = day_range_utc(date)
        query["created_at"] = {"$gte": start, "$lt": end}

    logs = water_logs_collection.find(query)
    return [serialize_water_log(log) for log in logs]


@app.post("/water-logs", response_model=WaterLog, status_code=status.HTTP_201_CREATED)
def add_water_log(log: WaterLogCreate, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    if log.amount_ml <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    log_dict = {
        "user_id": user_id,
        "amount_ml": log.amount_ml,
        "created_at": created_at_for_log_date(log.log_date)
    }

    result = water_logs_collection.insert_one(log_dict)
    new_log = water_logs_collection.find_one({"_id": result.inserted_id})

    if not new_log:
        logger.error("Water log creation failed: user_id=%s amount_ml=%s", user_id, log.amount_ml)
        raise HTTPException(status_code=500, detail="Water log creation failed")

    logger.info(
        "Water log added: user_id=%s log_id=%s amount_ml=%s log_date=%s",
        user_id,
        str(new_log["_id"]),
        log.amount_ml,
        log.log_date
    )

    return serialize_water_log(new_log)


@app.put("/water-logs/{log_id}", response_model=WaterLog)
def update_water_log(log_id: str, log: WaterLogUpdate, current_user=Depends(get_current_user)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid water log ID")

    if log.amount_ml <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    user_id = str(current_user["_id"])
    existing = water_logs_collection.find_one({"_id": ObjectId(log_id), "user_id": user_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Water log not found")

    water_logs_collection.update_one(
        {"_id": ObjectId(log_id)},
        {"$set": {"amount_ml": log.amount_ml}}
    )

    updated = water_logs_collection.find_one({"_id": ObjectId(log_id)})

    logger.info(
        "Water log updated: user_id=%s log_id=%s amount_ml=%s",
        user_id,
        log_id,
        log.amount_ml
    )

    return serialize_water_log(updated)


@app.delete("/water-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_water_log(log_id: str, current_user=Depends(get_current_user)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid water log ID")

    user_id = str(current_user["_id"])
    log = water_logs_collection.find_one({"_id": ObjectId(log_id), "user_id": user_id})

    if not log:
        raise HTTPException(status_code=404, detail="Water log not found")

    water_logs_archive_collection.insert_one(log)
    water_logs_collection.delete_one({"_id": ObjectId(log_id)})

    logger.info("Water log archived: user_id=%s log_id=%s", user_id, log_id)

    return


# ---------- Stats Page routes ----------
@app.get("/weekly-recap", response_model=WeeklyRecapOut)
def get_weekly_recap(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=6)

    daily = []
    total_consumed = 0
    total_burned = 0
    days_logged = 0

    for i in range(7):
        current_date = start_date + timedelta(days=i)

        start = datetime(
            current_date.year,
            current_date.month,
            current_date.day,
            tzinfo=timezone.utc
        )
        end = start + timedelta(days=1)

        food_logs = list(food_logs_collection.find({
            "user_id": user_id,
            "created_at": {"$gte": start, "$lt": end}
        }))

        exercise_logs = list(exercise_logs_collection.find({
            "user_id": user_id,
            "created_at": {"$gte": start, "$lt": end}
        }))

        consumed = sum(log.get("calories", 0) for log in food_logs)
        burned = sum(log.get("calories_burned", 0) for log in exercise_logs)
        net = consumed - burned

        if food_logs or exercise_logs:
            days_logged += 1

        total_consumed += consumed
        total_burned += burned

        daily.append({
            "date": current_date.isoformat(),
            "calories_consumed": consumed,
            "calories_burned": burned,
            "net_calories": net,
            "food_logs": len(food_logs),
            "exercise_logs": len(exercise_logs)
        })

    logger.info(
        "Weekly recap generated: user_id=%s week_start=%s week_end=%s days_logged=%s",
        user_id,
        start_date.isoformat(),
        today.isoformat(),
        days_logged
    )

    return {
        "week_start": start_date.isoformat(),
        "week_end": today.isoformat(),
        "total_consumed": total_consumed,
        "total_burned": total_burned,
        "net_calories": total_consumed - total_burned,
        "days_logged": days_logged,
        "daily": daily
    }


# ---------- Social Feed routes ----------
@app.get("/feed")
def feed_page():
    return FileResponse("static/feed.html")


@app.get("/feed/create")
def create_post_page():
    return FileResponse("static/create_post.html")


@app.get("/feed/profile")
def profile_page():
    return FileResponse("static/profile.html")

@app.get("/posts", response_model=List[PostOut])
def get_recent_posts(
    skip: int = 0,
    limit: int = 10,
    current_user=Depends(get_current_user)
):
    posts = posts_collection.find().sort("created_at", -1).skip(skip).limit(limit)
    return [serialize_post(post) for post in posts]

# ---------- Social Feed/Create Post routes ----------
@app.post("/posts", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    caption: str = Form(...),
    images: List[UploadFile] = File(...),
    current_user=Depends(get_current_user)
):
    if len(images) < 1 or len(images) > 5:
        logger.warning("Post creation failed: invalid image count user_id=%s image_count=%s", str(current_user["_id"]), len(images))
        raise HTTPException(status_code=400, detail="A post must have between 1 and 5 images.")

    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    saved_paths = []

    for image in images:
        if image.content_type not in allowed_types:
            logger.warning("Post creation failed: invalid image type user_id=%s content_type=%s", str(current_user["_id"]), image.content_type)
            raise HTTPException(status_code=400, detail="Only JPG, PNG, and WEBP images are allowed.")

        ext = os.path.splitext(image.filename)[1].lower()
        unique_name = f"{uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        saved_paths.append(f"/static/uploads/posts/{unique_name}")

    post_dict = {
        "user_id": str(current_user["_id"]),
        "username": current_user["username"],
        "profile_picture": current_user.get("profile_picture"),
        "caption": caption,
        "images": saved_paths,
        "created_at": datetime.now(timezone.utc),
        "likes": 0,
        "liked_by": []
    }
    result = posts_collection.insert_one(post_dict)
    new_post = posts_collection.find_one({"_id": result.inserted_id})

    if not new_post:
        logger.error("Post creation failed after insert: user_id=%s", str(current_user["_id"]))
        raise HTTPException(status_code=500, detail="Post creation failed")

    logger.info(
        "Post created: user_id=%s post_id=%s image_count=%s",
        str(current_user["_id"]),
        str(new_post["_id"]),
        len(saved_paths)
    )

    return serialize_post(new_post)

@app.put("/posts/{post_id}", response_model=PostOut)
def update_post(
    post_id: str,
    post_update: PostUpdate,
    current_user=Depends(get_current_user)
):
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    post = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post["user_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="You can only edit your own posts")

    result = posts_collection.update_one(
        {"_id": ObjectId(post_id)},
        {"$set": {"caption": post_update.caption}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")

    updated_post = posts_collection.find_one({"_id": ObjectId(post_id)})

    logger.info("Post updated: user_id=%s post_id=%s", str(current_user["_id"]), post_id)

    return serialize_post(updated_post)

@app.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(
    post_id: str,
    current_user=Depends(get_current_user)
):
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    post = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    if post["user_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    # Delete image files from disk
    for image_path in post.get("images", []):
        local_path = image_path.lstrip("/")
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except OSError:
                pass

    result = posts_collection.delete_one({"_id": ObjectId(post_id)})

    if result.deleted_count == 0:
        logger.warning("Post delete failed after delete attempt: post_id=%s", post_id)
        raise HTTPException(status_code=404, detail="Post not found")

    logger.info("Post deleted: user_id=%s post_id=%s", str(current_user["_id"]), post_id)

    return

# Like system for feed posts
@app.post("/posts/{post_id}/like")
def toggle_like(post_id: str, current_user=Depends(get_current_user)):
    if not ObjectId.is_valid(post_id):
        raise HTTPException(status_code=400, detail="Invalid post ID")

    post = posts_collection.find_one({"_id": ObjectId(post_id)})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    user_id = str(current_user["_id"])

    if user_id in post.get("liked_by", []):
        posts_collection.update_one(
            {"_id": ObjectId(post_id)},
            {
                "$pull": {"liked_by": user_id},
                "$inc": {"likes": -1}
            }
        )
        liked = False
        logger.info("Post unliked: user_id=%s post_id=%s", user_id, post_id)
    else:
        posts_collection.update_one(
            {"_id": ObjectId(post_id)},
            {
                "$addToSet": {"liked_by": user_id},
                "$inc": {"likes": 1}
            }
        )
        liked = True
        logger.info("Post liked: user_id=%s post_id=%s", user_id, post_id)

    updated_post = posts_collection.find_one({"_id": ObjectId(post_id)})

    return {
        "liked": liked,
        "likes": updated_post.get("likes", 0)
    }

# ---------- Profile page routes ----------
@app.get("/my-posts", response_model=List[PostOut])
def get_my_posts(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    posts = posts_collection.find({"user_id": user_id}).sort("created_at", -1)
    return [serialize_post(post) for post in posts]

@app.get("/my-profile-stats")
def get_my_profile_stats(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    posts = list(posts_collection.find({"user_id": user_id}))
    total_likes = sum(post.get("likes", 0) for post in posts)

    return {
        "post_count": len(posts),
        "total_likes": total_likes
    }
# ---------- Settings page routes ----------
@app.put("/settings/username", response_model=UserOut)
def update_username(
    username_update: UsernameUpdate,
    current_user=Depends(get_current_user)
):
    new_username = username_update.new_username.strip()

    if not new_username:
        raise HTTPException(status_code=400, detail="Username cannot be empty")

    existing_user = users_collection.find_one({"username": new_username})
    if existing_user and str(existing_user["_id"]) != str(current_user["_id"]):
        logger.warning("Username update failed: username already taken user_id=%s new_username=%s", str(current_user["_id"]), new_username)
        raise HTTPException(status_code=400, detail="Username already taken")

    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"username": new_username}}
    )

    posts_collection.update_many(
        {"user_id": str(current_user["_id"])},
        {"$set": {"username": new_username}}
    )

    updated_user = users_collection.find_one({"_id": current_user["_id"]})

    logger.info("Username updated: user_id=%s new_username=%s", str(current_user["_id"]), new_username)

    return serialize_user(updated_user)

@app.put("/settings/password")
def update_password(
    password_update: PasswordUpdate,
    current_user=Depends(get_current_user)
):
    if not verify_password(password_update.current_password, current_user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if not password_update.new_password.strip():
        raise HTTPException(status_code=400, detail="New password cannot be empty")

    new_hashed_password = hash_password(password_update.new_password)

    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password": new_hashed_password}}
    )

    logger.info("Password updated: user_id=%s", str(current_user["_id"]))

    return {"message": "Password updated successfully"}

@app.delete("/exercise-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_exercise_log(log_id: str, current_user=Depends(get_current_user)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid exercise log ID")

    user_id = str(current_user["_id"])
    log = exercise_logs_collection.find_one({"_id": ObjectId(log_id), "user_id": user_id})

    if not log:
        raise HTTPException(status_code=404, detail="Exercise log not found")

    exercise_logs_archive_collection.insert_one(log)
    exercise_logs_collection.delete_one({"_id": ObjectId(log_id)})

    logger.info("Exercise log archived: user_id=%s log_id=%s", user_id, log_id)

    return

@app.post("/settings/profile-picture", response_model=UserOut)
def upload_profile_picture(
    image: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    allowed_types = {"image/jpeg", "image/png", "image/webp"}

    if image.content_type not in allowed_types:
        logger.warning("Profile picture upload failed: invalid image type user_id=%s content_type=%s", str(current_user["_id"]), image.content_type)
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and WEBP images are allowed.")

    # delete old profile picture if one exists
    old_path = current_user.get("profile_picture")
    if old_path:
        local_old_path = old_path.lstrip("/")
        if os.path.exists(local_old_path):
            try:
                os.remove(local_old_path)
            except OSError:
                pass

    ext = os.path.splitext(image.filename)[1].lower()
    unique_name = f"{uuid4().hex}{ext}"
    file_path = os.path.join(USER_UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    public_path = f"/static/uploads/profile_pictures/{unique_name}"

    users_collection.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"profile_picture": public_path}}
    )

    posts_collection.update_many(
        {"user_id": str(current_user["_id"])},
        {"$set": {"profile_picture": public_path}}
    )

    updated_user = users_collection.find_one({"_id": current_user["_id"]})

    logger.info("Profile picture updated: user_id=%s path=%s", str(current_user["_id"]), public_path)

    return serialize_user(updated_user)

@app.get("/settings/goals", response_model=UserGoals)
def get_user_goals(current_user=Depends(get_current_user)):
    return serialize_goals(current_user)


@app.put("/settings/goals", response_model=UserGoals)
def update_user_goals(
    goals_update: UserGoalsUpdate,
    current_user=Depends(get_current_user)
):
    if goals_update.calorie_goal <= 0:
        raise HTTPException(status_code=400, detail="Calorie goal must be greater than 0")

    if goals_update.exercise_goal <= 0:
        raise HTTPException(status_code=400, detail="Exercise goal must be greater than 0")

    if goals_update.water_goal_ml <= 0:
        raise HTTPException(status_code=400, detail="Water goal must be greater than 0")

    users_collection.update_one(
        {"_id": current_user["_id"]},
        {
            "$set": {
                "calorie_goal": goals_update.calorie_goal,
                "exercise_goal": goals_update.exercise_goal,
                "water_goal_ml": goals_update.water_goal_ml
            }
        }
    )

    updated_user = users_collection.find_one({"_id": current_user["_id"]})

    logger.info(
        "User goals updated: user_id=%s calorie_goal=%s exercise_goal=%s water_goal_ml=%s",
        str(current_user["_id"]),
        goals_update.calorie_goal,
        goals_update.exercise_goal,
        goals_update.water_goal_ml
    )

    return serialize_goals(updated_user)


# ---------- Admin routes ----------
@app.get("/admin/users", response_model=List[UserSummary])
def get_all_users(current_user=Depends(require_admin)):
    logger.info("Admin user list viewed: admin_user_id=%s", str(current_user["_id"]))
    users = users_collection.find()
    return [serialize_user(user) for user in users]


@app.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, current_user=Depends(require_admin)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if str(current_user["_id"]) == user_id:
        logger.warning("Admin delete user failed: admin tried to delete self admin_user_id=%s", user_id)
        raise HTTPException(status_code=400, detail="Admins cannot delete themselves")

    result = users_collection.delete_one({"_id": ObjectId(user_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    food_logs_collection.delete_many({"user_id": user_id})
    exercise_logs_collection.delete_many({"user_id": user_id})
    water_logs_collection.delete_many({"user_id": user_id})

    logger.info("User deleted by admin: admin_user_id=%s deleted_user_id=%s", str(current_user["_id"]), user_id)

    return


@app.put("/admin/users/{user_id}/role")
def update_user_role(user_id: str, role_update: UserRoleUpdate, current_user=Depends(require_admin)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if role_update.role not in ["user", "admin"]:
        logger.warning("Admin role update failed: invalid role target_user_id=%s role=%s", user_id, role_update.role)
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")

    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Admins cannot change their own role")

    result = users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": role_update.role}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    updated_user = users_collection.find_one({"_id": ObjectId(user_id)})

    logger.info(
        "User role updated by admin: admin_user_id=%s target_user_id=%s new_role=%s",
        str(current_user["_id"]),
        user_id,
        role_update.role
    )

    return serialize_user(updated_user)

# ---------- Home routes ----------
@app.get("/home/today-stats", response_model=HomeTodayStats)
def get_home_today_stats(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    now = datetime.now(timezone.utc)
    start_of_day = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
    end_of_day = start_of_day + timedelta(days=1)

    food_logs = food_logs_collection.find({
        "user_id": user_id,
        "created_at": {
            "$gte": start_of_day,
            "$lt": end_of_day
        }
    })

    exercise_logs = exercise_logs_collection.find({
        "user_id": user_id,
        "created_at": {
            "$gte": start_of_day,
            "$lt": end_of_day
        }
    })

    calories_consumed_today = sum(log.get("calories", 0) for log in food_logs)
    calories_burned_today = sum(log.get("calories_burned", 0) for log in exercise_logs)
    net_calories_today = calories_consumed_today - calories_burned_today

    return {
        "calories_consumed_today": calories_consumed_today,
        "calories_burned_today": calories_burned_today,
        "net_calories_today": net_calories_today
    }


# ---------- Static assets ----------
app.mount("/static", StaticFiles(directory="static"), name="static")


# ---------- Page routes ----------
@app.get("/")
def root():
    return RedirectResponse(url="/home")


@app.get("/register")
def register_page():
    return FileResponse("static/register.html")


@app.get("/login")
def login_page():
    return FileResponse("static/login.html")


@app.get("/tracker")
def tracker_page():
    return FileResponse("static/index.html")


@app.get("/admin")
def admin_page():
    return FileResponse("static/admin.html")

@app.get("/stats")
def stats_page():
    return FileResponse("static/stats.html")

@app.get("/settings")
def settings_page():
    return FileResponse("static/settings.html")

@app.get("/home")
def home_page():
    return FileResponse("static/home.html")