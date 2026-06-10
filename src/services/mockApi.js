export async function fetchRoles(){
  const res = await fetch('/mock-data/roles.json');
  return res.ok ? res.json() : [];
}

export async function fetchActivity(){
  const res = await fetch('/mock-data/activity.json');
  return res.ok ? res.json() : [];
}

export async function fetchUsers(){
  const res = await fetch('/mock-data/users.json');
  return res.ok ? res.json() : [];
}
