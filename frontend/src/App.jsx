import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { WiredCard, WiredButton, WiredTab, WiredTabs } from 'wired-elements-react'
import GroupsPage from './pages/GroupsPage'
import MailPage from './pages/MailPage'
import DocsPage from './pages/DocsPage'
import './App.css'

function App() {
  return (
    <Router>
      <div className="app">
        <WiredCard style={{ margin: '20px', padding: '20px' }}>
          <h1>Distributed Authorization Demo</h1>
          <nav style={{ marginBottom: '20px' }}>
            <Link to="/groups" style={{ marginRight: '10px' }}>
              <WiredButton>Groups</WiredButton>
            </Link>
            <Link to="/mail" style={{ marginRight: '10px' }}>
              <WiredButton>Mail</WiredButton>
            </Link>
            <Link to="/docs">
              <WiredButton>Docs</WiredButton>
            </Link>
          </nav>
        </WiredCard>

        <Routes>
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/mail" element={<MailPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/" element={<GroupsPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
