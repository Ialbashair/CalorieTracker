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
from uuid import uuid4

# Initiates app
app = FastAPI()

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


class FoodLog(BaseModel):
    id: Optional[str] = None
    user_id: str
    food_name: str
    calories: int
    grams: Optional[float] = None
    created_at: Optional[str] = None


class FoodLogCreate(BaseModel):
    food_name: str
    calories: int
    grams: Optional[float] = None
    date: Optional[str] = None


class FoodLogUpdate(BaseModel):
    food_name: str
    calories: int
    grams: Optional[float] = None


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
    date: Optional[str] = None


class ExerciseLogUpdate(BaseModel):
    exercise_name: str
    calories_burned: int
    hours: Optional[float] = None


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

class HomeTodayStats(BaseModel):
    calories_consumed_today: int
    calories_burned_today: int
    net_calories_today: int

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


def day_range_utc(date_str: str) -> tuple[datetime, datetime]:
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def log_timestamp_for(date_str: Optional[str]) -> datetime:
    now_utc = datetime.now(timezone.utc)
    if not date_str:
        return now_utc
    try:
        d = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    selected = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    today = datetime(now_utc.year, now_utc.month, now_utc.day, tzinfo=timezone.utc)
    if selected == today:
        return now_utc
    return selected + timedelta(hours=12)


def serialize_food_log(log) -> dict:
    return {
        "id": str(log["_id"]),
        "user_id": log["user_id"],
        "food_name": log["food_name"],
        "calories": log["calories"],
        "grams": log.get("grams"),
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
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = users_collection.find_one({"username": user.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    user_dict = {
    "username": user.username,
    "email": user.email,
    "password": hash_password(user.password),
    "role": "user",
    "created_at": datetime.now(timezone.utc)
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

    log_dict = {
        "user_id": user_id,
        "food_name": log.food_name,
        "calories": log.calories,
        "grams": log.grams,
        "created_at": log_timestamp_for(log.date)
    }

    result = food_logs_collection.insert_one(log_dict)
    new_log = food_logs_collection.find_one({"_id": result.inserted_id})

    if not new_log:
        raise HTTPException(status_code=500, detail="Food log creation failed")

    return serialize_food_log(new_log)


@app.put("/food-logs/{log_id}", response_model=FoodLog)
def update_food_log(log_id: str, log: FoodLogUpdate, current_user=Depends(get_current_user)):
    if not ObjectId.is_valid(log_id):
        raise HTTPException(status_code=400, detail="Invalid food log ID")

    user_id = str(current_user["_id"])
    existing = food_logs_collection.find_one({"_id": ObjectId(log_id), "user_id": user_id})

    if not existing:
        raise HTTPException(status_code=404, detail="Food log not found")

    food_logs_collection.update_one(
        {"_id": ObjectId(log_id)},
        {"$set": {
            "food_name": log.food_name,
            "calories": log.calories,
            "grams": log.grams
        }}
    )

    updated = food_logs_collection.find_one({"_id": ObjectId(log_id)})
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
        "created_at": log_timestamp_for(log.date)
    }

    result = exercise_logs_collection.insert_one(log_dict)
    new_log = exercise_logs_collection.find_one({"_id": result.inserted_id})

    if not new_log:
        raise HTTPException(status_code=500, detail="Exercise log creation failed")

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
    return serialize_exercise_log(updated)


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
        raise HTTPException(status_code=400, detail="A post must have between 1 and 5 images.")

    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    saved_paths = []

    for image in images:
        if image.content_type not in allowed_types:
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
        raise HTTPException(status_code=500, detail="Post creation failed")

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
        raise HTTPException(status_code=404, detail="Post not found")

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
    else:
        posts_collection.update_one(
            {"_id": ObjectId(post_id)},
            {
                "$addToSet": {"liked_by": user_id},
                "$inc": {"likes": 1}
            }
        )
        liked = True

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

    return

@app.post("/settings/profile-picture", response_model=UserOut)
def upload_profile_picture(
    image: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    allowed_types = {"image/jpeg", "image/png", "image/webp"}

    if image.content_type not in allowed_types:
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

    updated_user = users_collection.find_one({"_id": current_user["_id"]})
    return serialize_user(updated_user)


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