import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useState } from 'react'
import Header from './components/Header'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import MailPage from './pages/MailPage'
import DocsPage from './pages/DocsPage'
import './App.css'

const users = [
  { id: 1, name: 'Alex Chen', username: 'achen', color: '#e74c3c' },
  { id: 2, name: 'Jordan Rivera', username: 'jrivera', color: '#3498db' },
  { id: 3, name: 'Taylor Kim', username: 'tkim', color: '#2ecc71' },
  { id: 4, name: 'Casey Morgan', username: 'cmorgan', color: '#f39c12' },
  { id: 5, name: 'Riley Thompson', username: 'rthompson', color: '#9b59b6' }
]

function App() {
  const [currentUser, setCurrentUser] = useState(users[0])

  return (
    <Router>
      <div className="app">
        <Header users={users} currentUser={currentUser} setCurrentUser={setCurrentUser} />
        
        <main className="main-content">
          <Routes key={currentUser.id}>
            <Route path="/groups" element={<GroupsPage currentUser={currentUser} />} />
            <Route path="/groups/:id" element={<GroupDetailPage currentUser={currentUser} />} />
            <Route path="/mail" element={<MailPage currentUser={currentUser} />} />
            <Route path="/docs" element={<DocsPage currentUser={currentUser} />} />
            <Route path="/" element={<GroupsPage currentUser={currentUser} />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
