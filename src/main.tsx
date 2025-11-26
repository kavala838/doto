import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import { auth } from './firebase'
import { onAuthStateChanged, signInWithEmailAndPassword } from 'firebase/auth'

function Root() {
  const [user, setUser] = useState<null | {}>(null)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setChecking(false)
    })
    return unsub
  }, [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (checking) return <div>Loading…</div>

  if (!user) {
    return (
      <div style={{ maxWidth: 320, margin: '80px auto', textAlign: 'center' }}>
        <h2>Login</h2>
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
        /><br/>
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        /><br/>
        <button
          onClick={async () => {
            try {
              setError('')
              await signInWithEmailAndPassword(auth, email, password)
            } catch (e: any) {
              setError(e.message ?? 'Login failed')
            }
          }}
        >
          Sign in
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    )
  }

  return <App />
}

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />)
