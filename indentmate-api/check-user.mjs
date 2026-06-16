// Login and test activities endpoint
const loginRes = await fetch('https://indentmate-ofk6.onrender.com/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ login_name: '12912', password: '123456' })
})
const loginData = await loginRes.json()
const token = loginData.token
console.log('Login status:', loginRes.status, '| Token:', token ? 'OK' : 'MISSING')

// Test activities search
const activitiesRes = await fetch(
  'https://indentmate-ofk6.onrender.com/api/indents/options/activities?projectCode=WMHEDS002&search=&limit=15&offset=0',
  { headers: { 'Authorization': `Bearer ${token}` } }
)
const activitiesData = await activitiesRes.json()
console.log('Activities status:', activitiesRes.status)
console.log('Total returned:', activitiesData.data?.length)
console.log('HasMore:', activitiesData.hasMore)
console.log('Sample:', activitiesData.data?.slice(0,3).map(a => `${a.activity_code} | ${a.description} | ${a.activity_type} | ${a.critical_capacity_type}`))

// Test search for 'Dum'
const searchRes = await fetch(
  'https://indentmate-ofk6.onrender.com/api/indents/options/activities?projectCode=WMHEDS002&search=Dum&limit=15&offset=0',
  { headers: { 'Authorization': `Bearer ${token}` } }
)
const searchData = await searchRes.json()
console.log('\nSearch "Dum" status:', searchRes.status, '| Results:', searchData.data?.length)
