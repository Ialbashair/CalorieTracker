# ---------- Imports ----------
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, RedirectResponse
from typing import List, Optional
from pymongo import MongoClient
from bson import ObjectId
from passlib.context import CryptContext

# ---------- Initialize app ----------
app = FastAPI()

# Debug print to confirm the correct file is running
print("MAIN.PY LOADED", flush=True)

# ---------- MongoDB setup ----------
MONGO_URL = "mongodb+srv://VSCODEUSER:VS4321@calorietracker.tpxabyz.mongodb.net/?authMechanism=SCRAM-SHA-1"

client = MongoClient(MONGO_URL)
database = client["Nutri"]

# Collections
entries_collection = database["Food_logs"]
users_collection = database["User_Info"]

print("Connected to database:", database.name, flush=True)
print("Entries collection:", entries_collection.name, flush=True)
print("Users collection:", users_collection.name, flush=True)

# ---------- Password hashing ----------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    print("hash_password() called", flush=True)
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    print("verify_password() called", flush=True)
    return pwd_context.verify(plain_password, hashed_password)

# ---------- Pydantic models ----------
# Temporarily using plain str for email while debugging.
# Once auth works, you can switch email back to EmailStr.
class CalorieEntry(BaseModel):
    id: Optional[str] = None
    user_id: str
    food_name: str
    calories: int

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

# ---------- Helper functions ----------
def serialize_entry(entry) -> dict:
    return {
        "id": str(entry["_id"]),
        "user_id": entry["user_id"],
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

# ---------- Calorie entry routes ----------
@app.get("/entries/{user_id}", response_model=List[CalorieEntry])
def get_user_entries(user_id: str):
    entries = entries_collection.find({"user_id": user_id})
    return [serialize_entry(entry) for entry in entries]

@app.post("/entries", response_model=CalorieEntry, status_code=status.HTTP_201_CREATED)
def add_entry(entry: CalorieEntry):
    print("POST /entries hit", flush=True)
    print("Incoming entry payload:", entry.model_dump(), flush=True)

    try:
        entry_dict = {
            "user_id": entry.user_id,
            "food_name": entry.food_name,
            "calories": entry.calories
        }

        result = entries_collection.insert_one(entry_dict)
        print("Inserted entry ID:", result.inserted_id, flush=True)

        new_entry = entries_collection.find_one({"_id": result.inserted_id})
        print("Fetched inserted entry:", new_entry, flush=True)

        return serialize_entry(new_entry)

    except Exception as e:
        print("ADD ENTRY ERROR:", repr(e), flush=True)
        raise HTTPException(status_code=500, detail=f"Add entry failed: {repr(e)}")

@app.put("/entries/{entry_id}/{user_id}", response_model=CalorieEntry)
def update_entry(entry_id: str, user_id: str, updated_item: CalorieEntry):
    print(f"PUT /entries/{entry_id} hit", flush=True)
    print("Incoming updated item:", updated_item.model_dump(), flush=True)

    try:
        if not ObjectId.is_valid(entry_id):
            print("Invalid ObjectId for update", flush=True)
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        result = entries_collection.update_one(
            {
                "_id": ObjectId(entry_id),
                "user_id": user_id
            },
            {
                "$set": {
                    "food_name": updated_item.food_name,
                    "calories": updated_item.calories
                }
            }
        )

        print("Matched count:", result.matched_count, flush=True)
        print("Modified count:", result.modified_count, flush=True)

        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")

        updated_entry = entries_collection.find_one({
            "_id": ObjectId(entry_id),
            "user_id": user_id
        })
        print("Fetched updated entry:", updated_entry, flush=True)

        return serialize_entry(updated_entry)

    except HTTPException:
        raise
    except Exception as e:
        print("UPDATE ENTRY ERROR:", repr(e), flush=True)
        raise HTTPException(status_code=500, detail=f"Update failed: {repr(e)}")

@app.delete("/entries/{entry_id}/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: str, user_id: str):
    print(f"DELETE /entries/{entry_id} hit", flush=True)

    try:
        if not ObjectId.is_valid(entry_id):
            print("Invalid ObjectId for delete", flush=True)
            raise HTTPException(status_code=400, detail="Invalid entry ID")

        result = entries_collection.delete_one({
            "_id": ObjectId(entry_id),
            "user_id": user_id
        })

        print("Deleted count:", result.deleted_count, flush=True)

        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")

        return

    except HTTPException:
        raise
    except Exception as e:
        print("DELETE ENTRY ERROR:", repr(e), flush=True)
        raise HTTPException(status_code=500, detail=f"Delete failed: {repr(e)}")
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
