"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { onSnapshot, Timestamp, collection, orderBy, query, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";

const card: React.CSSProperties = {
  background: "#0B1220",           // deep slate
  border: "1px solid #1f2937",     // slate-800
  borderRadius: 12,
  padding: 16,
  color: "#E5E7EB",                // slate-200
};

const heading: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  color: "#F9FAFB",                 // near white
};

const label: React.CSSProperties = { fontSize: 12, color: "#9CA3AF" }; // slate-400

type Student = {
    name?: string;
    email?: string;
    phone?: string;
    grade?: number;
    country?: string;
    status?: "Exploring" | "Shortlisting" | "Applying" | "Submitted";
    lastActive?: string | Timestamp;
};

type TimelineEvent = {
        id: string;
        type: "login" | "ai_question" | "doc_submission";
        text: string;
        timestamp: string;
    };

type CommItem = {
    id: string;
    type: "email" | "sms";
    direction: "out" | "in";
    subject?: string;
    message: string;
    to: string;
    from: string;
    status?: string;
    timestamp?: string;
};

type Note = {
    id: string;
    text: string;
    authorUid: string;
    authorName?: string;
    createdAt?: string;
    updatedAt?: string;
};

type Task = {
    id: string;
    title: string;
    status: "open" | "done";
    dueAt?: string;        // formatted for UI
    assignee?: string;
    createdAt?: string;
};

const TYPE_BG: Record<string, string> = {
  login: "#2563EB",           // blue
  ai_question: "#7C3AED",     // purple
  doc_submission: "#059669",  // green
};

const typeLabel = (t: TimelineEvent["type"]) =>
  t === "login" ? "Login" : t === "ai_question" ? "AI Question" : "Doc Uploaded";

export default function StudentPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const ref = doc(db, "students", id);
        const unsub = onSnapshot(ref, (snap) => {
            if (!snap.exists()) {
                // no such doc, go back to the list
                router.replace("/dashboard");
                return;
            }
            const data = snap.data() as any;
            const last = data.lastActive?.toDate
                ? data.lastActive.toDate().toISOString()
                : data.lastActive;
            setStudent({ ...data, lastActive: last });
            setLoading(false);
        });
        return () => unsub();
    }, [id, router]);

    const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

    useEffect(() => {
        const ref = collection(db, "students", id, "timeline");
        const q = query(ref, orderBy("timestamp", "desc"));

        const unsub = onSnapshot(q, (snap) => {
            const events = snap.docs.map((d) => {
                const data = d.data() as any;
                const ts = data.timestamp;
                const formatted = 
                ts?.toDate ? ts.toDate().toLocaleString()
                            : (typeof ts === "string" ? ts : "");
                return {
                    id: d.id, 
                    type: data.type,
                    text: data.text,
                    timestamp: formatted,
                } as TimelineEvent;
            });
            setTimeline(events);
        });
        return () => unsub();
    }, [id]);

    const [comm, setComm] = useState<CommItem[]>([]);

    useEffect(() => {
        const ref = collection(db, "students", id, "commLog");
        const q = query(ref, orderBy("timestamp", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const rows = snap.docs.map((d) => {
                const data = d.data() as any;
                const ts = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : "";
                return { id: d.id, ...data, timestamp: ts } as CommItem;
                });
                setComm(rows);
            });
            return () => unsub();
    }, [id]);

    const [notes, setNotes] = useState<Note[]>([]);
    const [newNote, setNewNote] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");

    useEffect(() => {
        const ref = collection(db, "students", id, "notes");
        const q = query(ref, orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snap) => {
            const rows = snap.docs.map((d) => {
                const data = d.data() as any;
                const created = data.createdAt?.toDate?.() ? data.createdAt.toDate().toLocaleString() : "";
                const updated = data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toLocaleString() : "";
                return { id: d.id, ...data, createdAt: created, updatedAt: updated } as Note;
            });
            setNotes(rows);
        });
        return () => unsub();
    }, [id]);

    async function addNote() {
        if (!newNote.trim()) return;
        const user = auth.currentUser;
        await addDoc(collection(db, "students", id, "notes"), {
            text: newNote.trim(),
            authorUid: user?.uid || "unknown",
            authorName: user?.email || user?.uid || "unknown",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        setNewNote("");
    }

    function startEdit(n: Note) {
        setEditingId(n.id);
        setEditingText(n.text);
    }

    async function saveEdit(noteId: string) {
        await updateDoc(doc(db, "students", id, "notes", noteId), {
            text: editingText,
            updatedAt: serverTimestamp(),
        });
        setEditingId(null);
        setEditingText("");
    }

    async function removeNote(noteId:string) {
        await deleteDoc(doc(db, "students", id, "notes", noteId));
    }

    const [newCommType, setNewCommType] = useState<"email" | "sms">("email");
    const [newCommDirection, setNewCommDirection] = useState<"out" | "in">("out");
    const [newCommTo, setNewCommTo] = useState(student?.email || "");
    const [newCommFrom, setNewCommFrom] = useState("team@undergraduation.com");
    const [newCommSubject, setNewCommSubject] = useState("");
    const [newCommMessage, setNewCommMessage] = useState("");

    async function logCommunication() {
        if (!newCommMessage.trim()) {
            alert("Please enter a message.");
            return;
        }

        await addDoc(collection(db, "students", id, "commLog"), {
            type: newCommType,                // "email" | "sms"
            direction: newCommDirection,      // "out" | "in"
            to: newCommTo || student?.email || "",
            from: newCommFrom || "team@undergraduation.com",
            subject: newCommType === "email" ? newCommSubject || null : null,
            message: newCommMessage.trim(),
            status: newCommType === "email" ? "sent" : null,
            timestamp: serverTimestamp(),        
        });

        // drop a short entry into the timeline
        await addDoc(collection(db, "students", id, "timeline"), {
            type: "comm",
            text: `${newCommType.toUpperCase()} ${newCommDirection}: ${newCommMessage.slice(0, 80)}`,
            timestamp: serverTimestamp(),
        });

        // reset form
        setNewCommMessage("");
        setNewCommSubject("");
    }

    async function triggerFollowupEmail() {
        await addDoc(collection(db, "students", id, "commLog"), {
            type: "email",
            direction: "out",
            to: student?.email || "",
            from: "team@undergraduation.com",
            subject: "Follow-up from Undergraduation",
            message: "Hi! Checking in on your application progress and essays. —Team",
            status: "queued",            // <-- mock state
            timestamp: serverTimestamp()
        });

        // (Optional) also drop a breadcrumb into the timeline
        await addDoc(collection(db, "students", id, "timeline"), {
            type: "comm",
            text: "Follow-up email queued",
            timestamp: serverTimestamp()
        });
        alert("Mock follow-up email queued.");
    }

    const [tasks, setTasks] = useState<Task[]>([]);
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDue, setTaskDue] = useState("");        // string from <input type="datetime-local">
    const [taskAssignee, setTaskAssignee] = useState(auth.currentUser?.email || "");

    useEffect(() => {
    const ref = collection(db, "students", id, "tasks");
    // sort open first, then by due date (nulls last)
    const q = query(ref, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
        const rows = snap.docs.map((d) => {
            const data = d.data() as any;
            const formattedDue =
            data.dueAt?.toDate ? data.dueAt.toDate().toLocaleString() : "";
        return {
            id: d.id,
            title: data.title,
            status: data.status,
            assignee: data.assignee,
            dueAt: formattedDue,
            createdAt: data.createdAt?.toDate?.()
            ? data.createdAt.toDate().toLocaleString()
            : "",
        } as Task;
        });
        setTasks(rows);
    });
    return () => unsub();
}, [id]);

    async function addTask() {
        if (!taskTitle.trim()) {
            alert("Please enter a task title.");
            return;
    }
    const dueTs =
    taskDue ? Timestamp.fromDate(new Date(taskDue)) : null;

    await addDoc(collection(db, "students", id, "tasks"), {
        title: taskTitle.trim(),
        status: "open",
        assignee: taskAssignee || null,
        dueAt: dueTs,
        createdAt: serverTimestamp(),
    });

    // (optional) drop a breadcrumb into timeline
    await addDoc(collection(db, "students", id, "timeline"), {
        type: "comm",
        text: `Task created: ${taskTitle.trim()}`,
        timestamp: serverTimestamp(),
    });

  setTaskTitle("");
  setTaskDue("");
}

    async function toggleTask(t: Task) {
    await updateDoc(doc(db, "students", id, "tasks", t.id), {
        status: t.status === "open" ? "done" : "open",
        updatedAt: serverTimestamp(),
    });
    }

    async function removeTask(taskId: string) {
    await deleteDoc(doc(db, "students", id, "tasks", taskId));
    }

    if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
    if (!student) return null;

    const STAGES = ["Exploring", "Shortlisting", "Applying", "Submitted"] as const;
    const currentIdx = Math.max(0, STAGES.indexOf((student.status as any) || "Exploring"));
    // calculating percentage
    const pct = Math.round(((currentIdx + 1) / STAGES.length) * 100);

    return (
        <div style={{ padding: 20 }}>
            <button onClick={() => router.push("/dashboard")} style={{ marginBottom: 12 }}>
                ← Back
            </button>

        <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 12 }}>
            {student.name}
        </h1>

        {/* Progress */}
        <div style={{ ...card, margin: "16px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <h2 style={heading}>Application Progress</h2>
                <span style={label}>{pct}%</span>
        </div>

        <div style={{ height: 12, background: "#111827", borderRadius: 999, overflow: "hidden", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.4)" }}>
            <div
            style={{
                width: `${pct}%`,
                height: "100%",
                background: "#22c55e",
                transition: "width 300ms ease",
            }}
            />
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {STAGES.map((s, i) => (
            <span
                key={s}
                style={{
                fontSize: 12,
                color: i <= currentIdx ? "#E5E7EB" : "#6B7280",     // active vs inactive
                }}
            >
                {s}
            </span>
            ))}
        </div>
        </div>

        {/* Mock email */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={heading}>Follow-up email</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={label}>{comm.length} item{comm.length !== 1 ? "s" : ""}</span>
                <button
                onClick={triggerFollowupEmail}
                className="px-3 py-2 rounded-md border border-gray-400 hover:bg-blue-500 hover:text-white transition"
                >
                Trigger Follow-up (mock)
                </button>
            </div>
        </div>

        {/* Communication Log */}
        <div style={{ ...card, marginTop: 16 }}>
            <div
                style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                }}
            >
                <h2 style={heading}>Communication Log</h2>
                <span style={label}>
                {comm.length} item{comm.length !== 1 ? "s" : ""}
                </span>
            </div>

            {/* Manual log form */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
                <select value={newCommType} onChange={e => setNewCommType(e.target.value as "email"|"sms")} style={{ padding: 8 }}>
                    <option value="email">email</option>
                    <option value="sms">sms</option>
                </select>
                <select value={newCommDirection} onChange={e => setNewCommDirection(e.target.value as "out"|"in")} style={{ padding: 8 }}>
                    <option value="out">out</option>
                    <option value="in">in</option>
                </select>
                <input placeholder="to" value={newCommTo} onChange={e => setNewCommTo(e.target.value)} style={{ padding: 8 }} />
                <input placeholder="from" value={newCommFrom} onChange={e => setNewCommFrom(e.target.value)} style={{ padding: 8 }} />
                <input
                    placeholder="subject (email only)"
                    value={newCommSubject}
                    onChange={e => setNewCommSubject(e.target.value)}
                    disabled={newCommType !== "email"}
                    style={{ padding: 8 }}
                />
                <div />
                <textarea
                    placeholder="Message / summary"
                    value={newCommMessage}
                    onChange={e => setNewCommMessage(e.target.value)}
                    rows={2}
                    style={{ gridColumn: "1 / span 5", padding: 8 }}
                />
                <button
                    onClick={logCommunication}
                    className="px-3 py-2 rounded-md border border-gray-400 hover:bg-blue-500 hover:text-white transition"
                    style={{ gridColumn: "6 / span 1" }}
                >
                    Log
                </button>
            </div>

            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {comm.map((c) => (
                <li
                    key={c.id}
                    style={{
                    display: "grid",
                    gridTemplateColumns: "120px 1fr auto",
                    gap: 12,
                    padding: 12,
                    borderTop: "1px solid #1f2937",
                    }}
                >
                    {/* left: type/direction */}
                    <span style={{ fontSize: 12, color: "#9CA3AF" }}>
                    [{c.type}/{c.direction}]
                    </span>

                    {/* middle: content */}
                    <div style={{ color: "#E5E7EB" }}>
                    {c.type === "email" && c.subject ? <strong>{c.subject}</strong> : null}
                    <div>{c.message}</div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                        to: {c.to} · from: {c.from} {c.status ? `· ${c.status}` : ""}
                    </div>
                    </div>

                    {/* right: timestamp */}
                    <time style={{ fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                    {c.timestamp}
                    </time>
                </li>
                ))}

                {comm.length === 0 && (
                <li style={{ padding: 12, color: "#9CA3AF" }}>No communication yet.</li>
                )}
            </ul>
        </div>

        <div style={{ ...card, marginTop: 16 }}>
            <h2 style={heading}>Internal Notes</h2>

        {/* Add note */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note for the team…"
            style={{ flex: 1, padding: "10px 12px", borderRadius: 8, border: "1px solid #1f2937", background: "#0b1220", color: "#E5E7EB" }}
            />
            <button onClick={addNote} className="px-3 py-2 rounded-md border border-gray-400 hover:border-blue-500 hover:bg-blue-500 hover:text-white transition">
            Add
            </button>
        </div>

        {/* Notes list */}
        <ul style={{ listStyle: "none", margin: 0, padding: 0, marginTop: 12 }}>
            {notes.map((n) => (
            <li key={n.id} style={{ borderTop: "1px solid #1f2937", padding: 12 }}>
                {/* View mode */}
                {editingId !== n.id ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
                    <div>
                        <div style={{ color: "#E5E7EB" }}>{n.text}</div>
                        <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>
                            by {n.authorName || n.authorUid} · {n.createdAt}
                            {n.updatedAt && n.updatedAt !== n.createdAt ? ` · edited ${n.updatedAt}` : ""}
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => startEdit(n)} className="px-2 py-1 rounded-md border border-gray-500 hover:bg-blue-500 hover:text-white transition">Edit</button>
                        <button onClick={() => removeNote(n.id)} className="px-2 py-1 rounded-md border border-gray-500 hover:bg-red-500 hover:text-white transition">Delete</button>
                    </div>
                </div>
                ) : (
        // Edit mode
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12 }}>
            <input
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #1f2937", background: "#0b1220", color: "#E5E7EB" }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => saveEdit(n.id)} className="px-2 py-1 rounded-md border border-gray-500 hover:bg-blue-500 hover:text-white transition">Save</button>
              <button onClick={() => { setEditingId(null); setEditingText(""); }} className="px-2 py-1 rounded-md border border-gray-500 hover:bg-gray-600 hover:text-white transition">Cancel</button>
            </div>
          </div>
        )}
      </li>
    ))}
    {notes.length === 0 && <li style={{ padding: 12, color: "#9CA3AF" }}>No notes yet.</li>}
  </ul>
</div>
{/* Team Tasks / Reminders */}
<div style={{ ...card, marginTop: 16 }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
    <h2 style={heading}>Team Tasks / Reminders</h2>
    <span style={label}>{tasks.length} item{tasks.length !== 1 ? "s" : ""}</span>
  </div>

  {/* Add task form */}
  <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 220px auto", gap: 8, marginBottom: 10 }}>
    <input
      value={taskTitle}
      onChange={(e) => setTaskTitle(e.target.value)}
      placeholder="Task title (e.g., 'Follow up on essay outline')"
      style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #1f2937", background: "#0b1220", color: "#E5E7EB" }}
    />
    <input
      type="datetime-local"
      value={taskDue}
      onChange={(e) => setTaskDue(e.target.value)}
      style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #1f2937", background: "#0b1220", color: "#E5E7EB" }}
    />
    <input
      value={taskAssignee}
      onChange={(e) => setTaskAssignee(e.target.value)}
      placeholder="Assignee (email)"
      style={{ padding: "10px 12px", borderRadius: 8, border: "1px solid #1f2937", background: "#0b1220", color: "#E5E7EB" }}
    />
    <button
      onClick={addTask}
      className="px-3 py-2 rounded-md border border-gray-400 hover:bg-blue-500 hover:text-white transition"
    >
      Add Task
    </button>
  </div>

  {/* Task list */}
  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
    {tasks.map((t) => (
      <li
        key={t.id}
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr 220px 160px auto",
          gap: 8,
          alignItems: "center",
          padding: 12,
          borderTop: "1px solid #1f2937",
        }}
      >
        <input
          type="checkbox"
          checked={t.status === "done"}
          onChange={() => toggleTask(t)}
          title="Mark done"
        />
        <div style={{ color: t.status === "done" ? "#9CA3AF" : "#E5E7EB", textDecoration: t.status === "done" ? "line-through" : "none" }}>
          {t.title}
        </div>
        <div style={{ color: "#9CA3AF" }}>{t.dueAt || "No due date"}</div>
        <div style={{ color: "#9CA3AF" }}>{t.assignee || "Unassigned"}</div>
        <button
          onClick={() => removeTask(t.id)}
          className="px-2 py-1 rounded-md border border-gray-500 hover:bg-red-500 hover:text-white transition"
        >
          Delete
        </button>
      </li>
    ))}
    {tasks.length === 0 && <li style={{ padding: 12, color: "#9CA3AF" }}>No tasks yet.</li>}
  </ul>
</div>

        {/* Timeline section */}
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {timeline.map((ev) => (
                <li
                key={ev.id}
                style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr auto",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px",
                    borderTop: "1px solid #1f2937",
                }}
                >
                {/* Type pill */}
                <span
                    style={{
                    display: "inline-block",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: TYPE_BG[ev.type],
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "center",
                    minWidth: 110,
                    }}
                >
                    {typeLabel(ev.type)}
                </span>

                {/* Event text */}
                <span style={{ color: "#E5E7EB" }}>{ev.text}</span>

                {/* Timestamp */}
                <time style={{ fontSize: 12, color: "#9CA3AF", whiteSpace: "nowrap" }}>
                    {ev.timestamp}
                </time>
                </li>
            ))}

            {timeline.length === 0 && (
                <li style={{ padding: 12, color: "#9CA3AF" }}>No events yet.</li>
            )}
            </ul>

            

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
            <div><strong>Email:</strong> {student.email}</div>
            <div><strong>Phone:</strong> {student.phone || "—"}</div>
            <div><strong>Grade:</strong> {student.grade ?? "—"}</div>
            <div><strong>Country:</strong> {student.country}</div>
            <div><strong>Status:</strong> {student.status}</div>
            <div>
            <strong>Last Active:</strong>{" "}
            {student.lastActive
                ? new Date(
                    typeof student.lastActive === "string"
                    ? student.lastActive
                    : (student.lastActive as Timestamp).toDate()
                ).toLocaleString()
                : "—"}
            </div>
        </div>
        </div>
    );
}