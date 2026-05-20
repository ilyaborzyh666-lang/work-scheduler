import { getAuth } from 'firebase/auth';

// Replace with your Railway/Render URL after deploy
const BASE_URL = 'https://your-app.railway.app';

async function getToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Server error');
  return data as T;
}

// Shifts
export const api = {
  shifts: {
    request: (date: string, type: string) =>
      request('POST', '/shifts/request', { date, type }),
    my: () => request('GET', '/shifts/my'),
    byDate: (date: string) => request('GET', `/shifts/date/${date}`),
    pending: () => request('GET', '/shifts/pending'),
    updateStatus: (id: string, status: string) =>
      request('PATCH', `/shifts/${id}/status`, { status }),
    updateHours: (id: string, start_time: string, end_time: string, duration_hours: number) =>
      request('PATCH', `/shifts/${id}/hours`, { start_time, end_time, duration_hours }),
    delete: (id: string) => request('DELETE', `/shifts/${id}`),
  },

  leaves: {
    request: (start_date: string, end_date: string, reason: string) =>
      request('POST', '/leaves/request', { start_date, end_date, reason }),
    my: () => request('GET', '/leaves/my'),
    pending: () => request('GET', '/leaves/pending'),
    updateStatus: (id: string, status: string) =>
      request('PATCH', `/leaves/${id}/status`, { status }),
  },

  employees: {
    all: () => request('GET', '/employees/'),
    setBlockOverride: (id: string, override: boolean) =>
      request('PATCH', `/employees/${id}/block-override`, { override }),
    weeklyHours: (id: string, date: string) =>
      request('GET', `/employees/${id}/weekly-hours?date=${date}`),
  },
};
