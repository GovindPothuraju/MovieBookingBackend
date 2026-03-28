# 🎬 Seat Layout Generation – Complete Guide

---

# 📌 Overview

This document explains how to generate seat layouts for a screen in a movie booking system.

It covers:

* Step-by-step logic
* Input → Processing → Output
* Database storage
* Edge cases
* Interview explanations

---

# 🎯 Goal

Generate seats like:

```
A1 A2 A3 A4   → VIP
B1 B2 B3 B4   → PREMIUM
C1 C2 C3 C4   → REGULAR
```

---

# 📥 Step 1: Input from Client

### Example Request Body

```json
{
  "rows": 3,
  "columns": 4,
  "layout": {
    "A": "VIP",
    "B": "PREMIUM"
  }
}
```

---

# 🧠 Meaning of Input

| Row | Category          |
| --- | ----------------- |
| A   | VIP               |
| B   | PREMIUM           |
| C   | DEFAULT (REGULAR) |

---

# ⚙️ Step 2: Validate Seat Categories

### Logic

```js
const allowedTypes = ["REGULAR", "VIP", "PREMIUM", "RECLINER"];
```

### Validation Loop

```js
for (let row in layout) {
  if (!allowedTypes.includes(layout[row])) {
    throw Error("Invalid category");
  }
}
```

---

## ✅ Valid Input Example

```json
{
  "A": "VIP",
  "B": "PREMIUM"
}
```

---

## ❌ Invalid Input Example

```json
{
  "A": "VIP",
  "B": "GOLD"
}
```

### Response

```json
{
  "success": false,
  "message": "Invalid seat type for row B"
}
```

---

## 🧠 Interview Explanation

> “I validate seat categories against a predefined enum to ensure data consistency and prevent invalid configurations.”

---

# 🔁 Step 3: Generate Rows

### Logic

```js
const rowLetter = String.fromCharCode(65 + i);
```

### Output

| i | Row |
| - | --- |
| 0 | A   |
| 1 | B   |
| 2 | C   |

---

# 🔁 Step 4: Generate Columns

```js
for (let j = 1; j <= columns; j++)
```

### Output

```
1, 2, 3, 4
```

---

# 🔥 Step 5: Create Seat Labels

```js
seatLabel = rowLetter + column
```

### Example

```
A1, A2, A3, A4
B1, B2, B3, B4
```

---

# 🎯 Step 6: Assign Category

```js
category = layout[rowLetter] || "REGULAR"
```

---

## Example Mapping

| Row | Category          |
| --- | ----------------- |
| A   | VIP               |
| B   | PREMIUM           |
| C   | REGULAR (default) |

---

# 🧩 Step 7: Generate Seats Array

### Generated Objects

```json
[
  {
    "screenId": "123",
    "row": "A",
    "column": 1,
    "seatLabel": "A1",
    "category": "VIP"
  },
  {
    "screenId": "123",
    "row": "B",
    "column": 1,
    "seatLabel": "B1",
    "category": "PREMIUM"
  },
  {
    "screenId": "123",
    "row": "C",
    "column": 1,
    "seatLabel": "C1",
    "category": "REGULAR"
  }
]
```

---

# 🗄️ Step 8: Store in Database

### Operation

```js
await Seat.insertMany(seats);
```

---

## Final Stored Data (Full Example)

```json
[
  { "row": "A", "column": 1, "seatLabel": "A1", "category": "VIP" },
  { "row": "A", "column": 2, "seatLabel": "A2", "category": "VIP" },
  { "row": "A", "column": 3, "seatLabel": "A3", "category": "VIP" },
  { "row": "A", "column": 4, "seatLabel": "A4", "category": "VIP" },

  { "row": "B", "column": 1, "seatLabel": "B1", "category": "PREMIUM" },
  { "row": "B", "column": 2, "seatLabel": "B2", "category": "PREMIUM" },

  { "row": "C", "column": 1, "seatLabel": "C1", "category": "REGULAR" },
  { "row": "C", "column": 2, "seatLabel": "C2", "category": "REGULAR" }
]
```

---

# 📊 Final Visual Layout

```
A1 A2 A3 A4   → VIP
B1 B2 B3 B4   → PREMIUM
C1 C2 C3 C4   → REGULAR
```

---

# ⚠️ Edge Cases

---

## 1. Invalid Screen ID

### Response

```json
{
  "success": false,
  "message": "Invalid screen ID"
}
```

---

## 2. Screen Not Found

```json
{
  "success": false,
  "message": "Screen not found"
}
```

---

## 3. Layout Already Exists

```json
{
  "success": false,
  "message": "Seat layout already exists"
}
```

---

## 4. Missing Rows or Columns

```json
{
  "success": false,
  "message": "Rows and columns are required"
}
```

---

## 5. Invalid Category

```json
{
  "success": false,
  "message": "Invalid seat type for row A"
}
```

---

# 📦 Final API Response

```json
{
  "success": true,
  "message": "Seat layout created successfully",
  "totalSeats": 12
}
```

---

# 🧠 Full Flow Summary

```
Request → Validate → Generate Rows → Generate Columns
→ Assign Category → Create Seat Objects → Store in DB → Respond
```

---

# 🎤 Interview Questions & Answers

---

## ❓ How do you generate seats?

> “I use nested loops to iterate through rows and columns, generate seat labels, and assign categories dynamically using a row-based mapping.”

---

## ❓ Why store seats separately?

> “Seats are static entities and storing them separately ensures scalability and efficient querying.”

---

## ❓ Why not generate seats every time?

> “Generating seats repeatedly is inefficient. Seats are generated once per screen and reused.”

---

## ❓ Where is seat availability stored?

> “Seat availability is handled at the show level, not in the seat collection.”

---

# 🚀 Final Conclusion

✔ Flexible seat categories
✔ Scalable design
✔ Optimized database operations
✔ Production-ready logic

---
