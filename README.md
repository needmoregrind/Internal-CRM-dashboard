# MVP Internal CRM Dashboard  

A minimal internal CRM-style dashboard built with **Next.js 15, Firebase (Auth + Firestore)**, and React.  
It allows the internal team to:  
- Track students and their application progress.  
- Log communications (emails, SMS).  
- Add/edit/delete internal notes.  
- Create team tasks and reminders.  

---

## Features  
- **Authentication**: Google Sign-In.  
- **Application Progress**: Stage tracking (Exploring → Shortlisting → Applying → Submitted).  
- **Communication Log**: Manual log, mock email triggers, SMS/email notes.  
- **Internal Notes**: Add, edit, delete notes for each student.  
- **Team Tasks / Reminders**: Assign, mark complete, delete tasks.  

---

## 🛠️ Tech Stack  
- **Next.js 15 (App Router)**  
- **React 18**  
- **Firebase** (Auth + Firestore)  
- **TypeScript**  

---

## Setup Instructions  

### 1. Clone the repository  
```bash
git clone https://github.com/needmoregrind/MVP-internal-CRM-dashboard.git
cd MVP-internal-CRM-dashboard

### 2. Install dependencies
npm install

### 3. Firebase setup
Go to Firebase Console.
Create a new project.
Enable Authentication → Google Sign-In.
Enable Firestore Database → start in test mode (or use custom rules).
Create a .env.local file in your project root with the following:
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

### 4. Run the app locally
npm run dev
Then open "http://localhost:3000" in the browser.

### 5. Demo/Loom video

https://www.loom.com/share/3d20653a3ec04aa495cf7c3809309cce?sid=ae7fddf5-cbff-48b3-b56f-c0f572fcf4ec