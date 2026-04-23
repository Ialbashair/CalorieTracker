# ---------- Imports ----------
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from pydantic_settings import BaseSettings, SettingsConfigDict
from pymongo import MongoClient
from bson import ObjectId

app = FastAPI()

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
exercises_collection = database["Exercises"]
exercise_logs_collection = database["Exercise_logs"]

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


class UserRoleUpdate(BaseModel):
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class FoodLog(BaseModel):
    id: Optional[str] = None
    user_id: str
    food_name: str
    calories: int
    created_at: Optional[str] = None


class FoodLogCreate(BaseModel):
    food_name: str
    calories: int


class ExerciseLog(BaseModel):
    id: Optional[str] = None
    user_id: str
    exercise_name: str
    calories_burned: int
    created_at: Optional[str] = None


class ExerciseLogCreate(BaseModel):
    exercise_name: str
    calories_burned: int


class UserSummary(BaseModel):
    id: str
    username: str
    email: str
    role: str


# ---------- Helper functions ----------
def serialize_user(user) -> dict:
    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user["role"]
    }


def serialize_food_log(log) -> dict:
    return {
        "id": str(log["_id"]),
        "user_id": log["user_id"],
        "food_name": log["food_name"],
        "calories": log["calories"],
        "created_at": log["created_at"].isoformat() if "created_at" in log and log["created_at"] else None
    }


def serialize_exercise_log(log) -> dict:
    return {
        "id": str(log["_id"]),
        "user_id": log["user_id"],
        "exercise_name": log["exercise_name"],
        "calories_burned": log["calories_burned"],
        "created_at": log["created_at"].isoformat() if "created_at" in log and log["created_at"] else None
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


@app.post("/login", response_model=TokenResponse)
def login_user(user: UserLogin):
    existing_user = users_collection.find_one({"email": user.email})

    if not existing_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(user.password, existing_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(str(existing_user["_id"]))

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
    foods = foods_collection.find({}, {"_id": 0, "name": 1, "calories": 1, "serving_size_g": 1})
    return [
        {
            "name": f["name"],
            "calories": f["calories"],
            "serving_size_g": f["serving_size_g"]
        }
        for f in foods
    ]


@app.get("/food-logs", response_model=List[FoodLog])
def get_food_logs(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    logs = food_logs_collection.find({"user_id": user_id})
    return [serialize_food_log(log) for log in logs]


@app.post("/food-logs", response_model=FoodLog, status_code=status.HTTP_201_CREATED)
def add_food_log(log: FoodLogCreate, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    log_dict = {
        "user_id": user_id,
        "food_name": log.food_name,
        "calories": log.calories,
        "created_at": datetime.now(timezone.utc)
    }

    result = food_logs_collection.insert_one(log_dict)
    new_log = food_logs_collection.find_one({"_id": result.inserted_id})

    if not new_log:
        raise HTTPException(status_code=500, detail="Food log creation failed")

    return serialize_food_log(new_log)


# ---------- Exercise routes ----------
@app.get("/exercises")
def get_exercises(current_user=Depends(get_current_user)):
    exercises = exercises_collection.find({}, {"_id": 0, "name": 1, "calories_per_hour": 1})
    return [{"name": e["name"], "calories_per_hour": e["calories_per_hour"]} for e in exercises]


@app.get("/exercise-logs", response_model=List[ExerciseLog])
def get_exercise_logs(current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])
    logs = exercise_logs_collection.find({"user_id": user_id})
    return [serialize_exercise_log(log) for log in logs]


@app.post("/exercise-logs", response_model=ExerciseLog, status_code=status.HTTP_201_CREATED)
def add_exercise_log(log: ExerciseLogCreate, current_user=Depends(get_current_user)):
    user_id = str(current_user["_id"])

    log_dict = {
        "user_id": user_id,
        "exercise_name": log.exercise_name,
        "calories_burned": log.calories_burned,
        "created_at": datetime.now(timezone.utc)
    }

    result = exercise_logs_collection.insert_one(log_dict)
    new_log = exercise_logs_collection.find_one({"_id": result.inserted_id})

    if not new_log:
        raise HTTPException(status_code=500, detail="Exercise log creation failed")

    return serialize_exercise_log(new_log)


# ---------- Admin routes ----------
@app.get("/admin/users", response_model=List[UserSummary])
def get_all_users(current_user=Depends(require_admin)):
    users = users_collection.find()
    return [serialize_user(user) for user in users]


@app.delete("/admin/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: str, current_user=Depends(require_admin)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Admins cannot delete themselves")

    result = users_collection.delete_one({"_id": ObjectId(user_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    food_logs_collection.delete_many({"user_id": user_id})
    exercise_logs_collection.delete_many({"user_id": user_id})

    return


@app.put("/admin/users/{user_id}/role")
def update_user_role(user_id: str, role_update: UserRoleUpdate, current_user=Depends(require_admin)):
    if not ObjectId.is_valid(user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if role_update.role not in ["user", "admin"]:
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
    return serialize_user(updated_user)


# ---------- Static assets ----------
app.mount("/static", StaticFiles(directory="static"), name="static")


# ---------- Page routes ----------
@app.get("/")
def root():
    return RedirectResponse(url="/login")


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


@app.get("/feed")
def feed_page():
    return FileResponse("static/feed.html")