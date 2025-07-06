import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import HomePage from './components/HomePage';
import GoalTreeView from './components/GoalTreeView';
import './App.css';

function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/goal/:id" element={<GoalTreeView />} />
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;
