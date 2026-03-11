from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List, Optional

app = FastAPI()

class CalorieEntry(BaseModel):
    id: Optional[int] = None
    food_name: str
    calories: int

db: List[CalorieEntry] = []
id_counter = 1

@app.get("/entries", response_model=List[CalorieEntry])
def get_all_entries():
    return db

@app.post("/entries", response_model=CalorieEntry, status_code=status.HTTP_201_CREATED)
def add_entry(entry: CalorieEntry):
    global id_counter
    entry.id = id_counter
    db.append(entry)
    id_counter += 1
    return entry

@app.put("/entries/{entry_id}", response_model=CalorieEntry)
def update_entry(entry_id: int, updated_item: CalorieEntry):
    for i, item in enumerate(db):
        if item.id == entry_id:
            updated_item.id = entry_id
            db[i] = updated_item
            return updated_item
    raise HTTPException(status_code=404, detail="Item not found")

@app.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: int):
    for i, item in enumerate(db):
        if item.id == entry_id:
            db.pop(i)
            return
    raise HTTPException(status_code=404, detail="Item not found")

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")