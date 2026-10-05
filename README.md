# 📅 Daily Progress Tracker

A beautiful, animated habit and task tracking application built with React, TailwindCSS, Recharts, Framer Motion, and a robust local database via IndexedDB.

## ✨ Features

- ✅ **Add and Edit Daily Habits**: Create tasks with custom names and priorities.
- ✅ **Flexible Task Scheduling**: Choose exactly which days of the week a task should repeat (e.g., everyday, just weekends, or specific days).
- ✅ **Accurate Analytics**: Progress graphs and tracking accurately account for tasks only scheduled on specific days.
- ✅ **Visual Progress**: See your performance via beautiful radar, bar, and line charts.
- ✅ **Bulk Import Tasks**: Upload a `.txt` file to automatically add multiple tasks at once.
- ✅ **Interactive Calendar**: Check off completions effortlessly in the daily history view.
- ✅ **Robust Local Storage**: Uses IndexedDB (`idb`) to safely and persistently store your progress inside your browser without limits.
- ✅ **Weekly & Monthly Summaries**: Get macro-level insights on your productivity.

## 📝 Bulk Import Format

You can quickly add multiple tasks by uploading a `.txt` file using the **Import .txt** button. Each line represents a task and follows this format:
`Task Name | Priority | Days`

* **Priority**: (optional) `high`, `medium`, or `low` (defaults to medium)
* **Days**: (optional) Comma-separated numbers representing active days (0 = Sunday, 1 = Monday, ..., 6 = Saturday). Defaults to all days.

*Example `tasks.txt`:*
```
Morning Workout | high | 1, 3, 5
Read a book | medium
Water Plants | low | 0, 6
```

## 🛠 Tech Stack

- React + Vite
- TailwindCSS
- Recharts
- Framer Motion
- Lucide React (Icons)
- IndexedDB (`idb`)

## 🚀 Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/daily-tracker.git
cd daily-tracker
npm install
npm run dev
```