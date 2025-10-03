"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "../../lib/firebase";
import { 
  collection, 
  onSnapshot, 
  orderBy, 
  query, 
  limit, 
  Timestamp,
  getDocs
} from "firebase/firestore";
import Link from "next/link";

// Student type (matches my Firestore fields)
type Student = {
  id: string;
  name: string;
  email: string;
  country: string;
  status: "Exploring" | "Shortlisting" | "Applying" | "Submitted";
  lastActive?: string | Timestamp; // ? means the field is optional
  highIntent?: boolean;
};

type StudentRow = {
  id: string;
  name: string;
  email: string;
  country?: string;
  status: "Exploring" | "Shortlisting" | "Applying" | "Submitted";
  lastActive?: string;
};

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecking(false);
      if (!u) router.replace("/login");
    });
  }, [router]);

  // NEW: search + status filter
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<
  "All" | "Exploring" | "Shortlisting" | "Applying" | "Submitted"
  >("All");

  // Live Firestore subscription
  useEffect (() => {
    if (!user) return;
    const ref = collection(db, "students");
    const q = query(ref, orderBy("lastActive", "desc"), limit(500));

    // onSnapshot = real-time updates
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as any;

        // Normalize lastActive: Firestore Timestamp or string -> ISO string
        let last = data.lastActive;
        if (last && typeof last?.toDate === "function") {
          last = (last as Timestamp).toDate().toISOString();
        }
        return { id: d.id, ...data, lastActive: last } as Student;
      });
      setStudents(rows);
    });
    return () => unsub();
  }, [user]);

  // NEW: derive filtered list
  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase();
    return students.filter((s) => {
      const matchesText = 
      !needle ||
      s.name?.toLowerCase().includes(needle) ||
      s.email?.toLowerCase().includes(needle);

      const matchesStatus = 
        statusFilter === "All" ? true : s.status === statusFilter;

        return matchesText && matchesStatus;
    });
  }, [students, q, statusFilter]);

  // Derived counts
  // Define the four possible stages
  const stages = ["Exploring", "Shortlisting", "Applying", "Submitted"] as const;
  const counts = useMemo(
    () =>
    Object.fromEntries(
      stages.map((s) => [s, students.filter((x) => x.status === s).length])
    ) as Record<(typeof stages)[number], number>,
    [students]
  );

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (checking) return null;

  return (
    <div style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Dashboard</h1>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#555" }}>
            Signed in as <strong>{user?.email}</strong>
          </div>
          <button 
            onClick={handleSignOut} 
            className="px-3 py-2 rounded-md border border-gray-400 hover:border-blue-500 hover:bg-blue-500 hover:text-white transition"
            >
            Sign Out
          </button>
        </div>
      </div>

  {/* Controls */}
  <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
    <input
      value={q}
      onChange={(e) => setQ(e.target.value)}
      placeholder="Search by name or email..."
      style={{
        padding: "10px 12px",
        background: "#fff",
        color: "black",
        border: "1px solid #ddd",
        borderRadius: 8,
        minWidth: 280,
      }}
    />

    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {(["All", "Exploring", "Shortlisting", "Applying", "Submitted"] as const).map((opt) => {
        const active = statusFilter === opt;
        return (
          <button
            key={opt}
            onClick={() => setStatusFilter(opt)}
            style={{
              padding: "6px 10px",
              borderRadius: 999,
              border: active ? "1px solid #2563eb" : "1px solid #e5e7eb",
              background: active ? "#2563eb" : "#fff",
              color: active ? "#fff" : "#000",
              fontSize: 12,
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </div>      

      {/* Summary cards (from Firestore data) */}
      <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(4, minmax(0,1fr))", 
              gap: 12, 
              marginBottom: 16 
            }}
      >
        {stages.map((stage) => (
          <div
           key={stage} 
           style={{ 
            background: "#fff", 
            border: "1px solid #eee", 
            borderRadius: 10, 
            padding: 14 
          }}
          >
            <div style={{ fontSize: 22, fontWeight: 700 , color: "black"}}>{counts[stage]}</div>
            <div style={{ fontSize: 12, color: "#555" }}>{stage}</div>
          </div>
        ))}
      </div>

      {/* Table (from Firestore data) */}
      <div 
        style={{ 
          overflowX: "auto", 
          background: "#fff", 
          border: "1px solid #eee", 
          borderRadius: 10 
          }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              {["Name", "Email", "Country", "Status", "Last Active"].map(
                (h) => (
                <th 
                  key={h} 
                  style={{ 
                    textAlign: "left", 
                    padding: "10px 12px", 
                    fontSize: 12, 
                    color: "#555", 
                    }}
                >
                  {h}
                </th>
              )
              )}
            </tr>
          </thead>

          <tbody>
          {filtered.map((s) => (
            <tr
              key={s.id}
              style={{ borderTop: "1px solid #eee", cursor: "pointer" }}
              onClick={() => router.push(`/students/${s.id}`)}
            >
              <td style={{ padding: "10px 12px", color: "#000" }}>
                <Link href={`/students/${s.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                  {s.name}
                </Link>
              </td>
              <td style={{ padding: "10px 12px", color: "#000" }}>{s.email}</td>
              <td style={{ padding: "10px 12px", color: "#000" }}>{s.country}</td>
              <td style={{ padding: "10px 12px", color: "#000" }}>
                <span style={{ fontSize: 12, padding: "2px 8px", border: "1px solid #e5e7eb", borderRadius: 999 }}>
                  {s.status}
                </span>
              </td>
              <td style={{ padding: "10px 12px", color: "#000" }}>
                {s.lastActive
                  ? new Date(
                      typeof s.lastActive === "string"
                        ? s.lastActive
                        : s.lastActive?.toDate()
                    ).toLocaleString()
                  : "-"}
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} style={{ padding: 12, color: "#888" }}>
                No matching students.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}