# ---------- Imports ----------
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, EmailStr
from pydantic_settings import BaseSettings, SettingsConfigDict
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from typing import List, Optional
from pymongo import MongoClient
from bson import ObjectId
from passlib.context import CryptContext

# ---------- Initialize app ----------
app = FastAPI()

# ---------- MongoDB setup ----------
class MongoDBSettings(BaseSettings):
    url: str = ""

    model_config = SettingsConfigDict(env_file="./.env")

MONGO_URL = MongoDBSettings().url

client = MongoClient(MONGO_URL)
database = client["Nutri"]

# Collections
entries_collection = database["Food_logs"]
users_collection = database["User_Info"]

# ---------- Password hashing ----------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# ---------- Pydantic models ----------
class CalorieEntry(BaseModel):
    id: Optional[str] = None
    food_name: str
    calories: int

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    username: str
    email: EmailStr
    role: str

# ---------- Helper functions ----------
def serialize_entry(entry) -> dict:
    return {
        "id": str(entry["_id"]),
        "food_name": entry["food_name"],
        "calories": entry["calories"]
    }

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

    return serialize_user(new_user)

@app.post("/login")
def login_user(user: UserLogin):
    existing_user = users_collection.find_one({"email": user.email})

    if not existing_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(user.password, existing_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "message": "Login successful",
        "user": serialize_user(existing_user)
    }

# ---------- Calorie entry routes ----------
@app.get("/entries", response_model=List[CalorieEntry])
def get_all_entries():
    entries = entries_collection.find()
    return [serialize_entry(entry) for entry in entries]

@app.post("/entries", response_model=CalorieEntry, status_code=status.HTTP_201_CREATED)
def add_entry(entry: CalorieEntry):
    entry_dict = {
        "food_name": entry.food_name,
        "calories": entry.calories
    }

    result = entries_collection.insert_one(entry_dict)
    new_entry = entries_collection.find_one({"_id": result.inserted_id})

    return serialize_entry(new_entry)

@app.put("/entries/{entry_id}", response_model=CalorieEntry)
def update_entry(entry_id: str, updated_item: CalorieEntry):
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry ID")

    result = entries_collection.update_one(
        {"_id": ObjectId(entry_id)},
        {
            "$set": {
                "food_name": updated_item.food_name,
                "calories": updated_item.calories
            }
        }
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")

    updated_entry = entries_collection.find_one({"_id": ObjectId(entry_id)})
    return serialize_entry(updated_entry)

@app.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: str):
    if not ObjectId.is_valid(entry_id):
        raise HTTPException(status_code=400, detail="Invalid entry ID")

    result = entries_collection.delete_one({"_id": ObjectId(entry_id)})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")

    return

# ---------- Static assets ----------
# Keep CSS, JS, images, favicon in the static folder
app.mount("/static", StaticFiles(directory="static"), name="static")

# ---------- Page routes ----------
# Send users to login first when they visit the site
@app.get("/")
def root():
    return RedirectResponse(url="/login")

# Serve register page
@app.get("/register")
def register_page():
    return FileResponse("static/register.html")

# Serve login page
@app.get("/login")
def login_page():
    return FileResponse("static/login.html")

# Serve the main tracker page
@app.get("/tracker")
def tracker_page():
    return FileResponse("static/index.html")