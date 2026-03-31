import { Navigate } from "react-router-dom";

export const ProtectedRoute = ({ children }) => {
  const user = localStorage.getItem("user");
console.log(user);
  return user ? children : <Navigate to="/login" />;
};
