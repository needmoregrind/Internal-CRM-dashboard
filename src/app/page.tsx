'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  collectionGroup,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase'; // relative path from src/app → src/lib

type ApplicationStatus = 'Exploring' | 'Shortlisting' | 'Applying' | 'Submitted';
type Student = {
  id: string;
  name?: string;
  email?: string;
  country?: string;
  grade?: string | number;
  status?: ApplicationStatus;
  lastActive?: string;
};

type CommDoc = {
  // commLog docs; we’ll only need timestamp
  timestamp?: any;
};

export default function Home() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Load students
      const sSnap = await getDocs(collection(db, 'students'));
      const sRows = sSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Student[];
      setStudents(sRows);
      setLoading(false);
    })();
  }, []);

  // Counts per status
  const stats = useMemo(() => {
    const by = { total: students.length, Exploring: 0, Shortlisting: 0, Applying: 0, Submitted: 0 } as
      { total: number } & Record<ApplicationStatus, number>;
    for (const s of students) {
      if (s.status && by[s.status] !== undefined) by[s.status]++;
    }
    return by;
  }, [students]);

  // Not contacted in 7 days (uses collectionGroup on students/{id}/commLog)
  const [notContacted, setNotContacted] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      // Find studentIds that DO have comms within 7 days
      const cg = query(
        collectionGroup(db, 'commLog'),
        where('timestamp', '>=', sevenDaysAgo)
      );
      const cgSnap = await getDocs(cg);
      const recentlyContacted = new Set<string>();
      cgSnap.forEach((docSnap) => {
        const studentId = docSnap.ref.parent.parent?.id; // parent of commLog subcol
        if (studentId) recentlyContacted.add(studentId);
      });
      // Everyone else = not contacted
      const ids = students
        .map((s) => s.id)
        .filter((id) => !recentlyContacted.has(id));
      setNotContacted(ids);
    })();
  }, [students]);

  // Simple “high intent” & “needs essay help” placeholders:
  // You can drive these by fields on the student doc if you have them,
  // or leave them empty if not in your data.
  const highIntent: Student[] = [];        // plug in your real logic when available
  const needsEssayHelp: Student[] = [];    // plug in your real logic when available

  const byId = new Map(students.map((s) => [s.id, s]));
  const listNotContacted = notContacted
    .map((id) => byId.get(id))
    .filter(Boolean) as Student[];

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Dashboard</h1>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12, marginBottom: 16 }}>
        {[
          ['Total', stats.total],
          ['Exploring', stats.Exploring],
          ['Shortlisting', stats.Shortlisting],
          ['Applying', stats.Applying],
          ['Submitted', stats.Submitted],
        ].map(([label, value]) => (
          <div key={label as string} style={{ background: '#0B1220', border: '1px solid #1f2937', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{value as number}</div>
            <div style={{ color: '#9CA3AF' }}>{label as string}</div>
          </div>
        ))}
      </div>

      {/* Quick filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12 }}>
        <QuickList
          title={`Not contacted in 7 days (${listNotContacted.length})`}
          list={listNotContacted}
        />
        <QuickList title={`High intent (${highIntent.length})`} list={highIntent} />
        <QuickList title={`Needs essay help (${needsEssayHelp.length})`} list={needsEssayHelp} />
      </div>

      {loading && <div style={{ marginTop: 12 }}>Loading…</div>}
    </div>
  );
}

function QuickList({ title, list }: { title: string; list: Student[] }) {
  return (
    <div style={{ background: '#0B1220', border: '1px solid #1f2937', borderRadius: 12, padding: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {list.slice(0, 8).map((s) => (
          <li key={s.id} style={{ marginBottom: 6 }}>
            <Link href={`/students/${s.id}`} style={{ color: '#60a5fa' }}>
              {s.name || s.email || s.id}
            </Link>
          </li>
        ))}
        {list.length === 0 && <li style={{ color: '#9CA3AF' }}>None</li>}
      </ul>
    </div>
  );
}
