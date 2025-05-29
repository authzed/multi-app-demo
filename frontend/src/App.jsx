import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import MailPage from './pages/MailPage'
import FolderDetailPage from './pages/FolderDetailPage'
import DocumentEditPage from './pages/DocumentEditPage'
import './App.css'

function App() {
  const [users, setUsers] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchUsers = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:3001/api/users')
      const userData = await response.json()
      setUsers(userData)
      
      // Initialize current user from localStorage or default to first user
      const savedUserId = localStorage.getItem('selectedUserId')
      if (savedUserId) {
        const savedUser = userData.find(user => user.id === parseInt(savedUserId))
        setCurrentUser(savedUser || userData[0])
      } else {
        setCurrentUser(userData[0])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
      // Fallback to empty state
      setUsers([])
      setCurrentUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // Save to localStorage whenever user changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('selectedUserId', currentUser.id.toString())
    }
  }, [currentUser])

  if (loading) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <h2>Loading...</h2>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <h2>Failed to load users</h2>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <div className="app">
        <Header users={users} currentUser={currentUser} setCurrentUser={setCurrentUser} />
        
        <main className="main-content">
          <Routes key={currentUser.id}>
            <Route path="/groups" element={<GroupsPage currentUser={currentUser} />} />
            <Route path="/groups/:username" element={<GroupDetailPage currentUser={currentUser} />} />
            <Route path="/mail" element={<MailPage currentUser={currentUser} />} />
            <Route path="/docs" element={<FolderDetailPage currentUser={currentUser} />} />
            <Route path="/docs/folder/:folderId" element={<FolderDetailPage currentUser={currentUser} />} />
            <Route path="/docs/document/:documentId" element={<DocumentEditPage currentUser={currentUser} />} />
            <Route path="/" element={<GroupsPage currentUser={currentUser} />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
