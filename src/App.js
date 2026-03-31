import './App.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { GoogleOAuthProvider } from "@react-oauth/google";

import { Home } from './Home';
import { Room } from './Room';

import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';

function App() {
  return (
    <GoogleOAuthProvider clientId="382324523430-2pe2o55alst71p4oug0b9cgmmvo75mtb.apps.googleusercontent.com">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />   {/* 👈 Login page */}
          <Route path="/home" element={
            // <ProtectedRoute>
              <Home />
            // </ProtectedRoute>
          } />
          <Route path="/room/:id" element={
            <ProtectedRoute>
              <Room />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;