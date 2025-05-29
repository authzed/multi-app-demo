import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Header from './components/Header'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import MailPage from './pages/MailPage'
import FolderDetailPage from './pages/FolderDetailPage'
import DocumentEditPage from './pages/DocumentEditPage'
import './App.css'

const users = [
  { id: 1, name: 'Alex Chen', username: 'achen', color: '#e74c3c' },
  { id: 2, name: 'Jordan Rivera', username: 'jrivera', color: '#3498db' },
  { id: 3, name: 'Taylor Kim', username: 'tkim', color: '#2ecc71' },
  { id: 4, name: 'Casey Morgan', username: 'cmorgan', color: '#f39c12' },
  { id: 5, name: 'Riley Thompson', username: 'rthompson', color: '#9b59b6' }
]

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    // Initialize from localStorage or default to first user
    const savedUserId = localStorage.getItem('selectedUserId')
    if (savedUserId) {
      const savedUser = users.find(user => user.id === parseInt(savedUserId))
      return savedUser || users[0]
    }
    return users[0]
  })

  // Save to localStorage whenever user changes
  useEffect(() => {
    localStorage.setItem('selectedUserId', currentUser.id.toString())
  }, [currentUser])

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
