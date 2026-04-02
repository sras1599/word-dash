import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './pages/Home/Home'
import { Lobby } from './pages/Lobby/Lobby'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby/:roomCode" element={<Lobby />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
