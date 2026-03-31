import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { useState } from "react";

export const Login = () => {
  const navigate = useNavigate();

  const [isSignup, setIsSignup] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  // 🔹 Handle input
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // 🔹 Google Login
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await axios.post(
        "https://meeting-project-be-production.up.railway.app/api/auth/google",
        {
          token: credentialResponse.credential,
        },
      );

      localStorage.setItem("user", JSON.stringify(res.data));
      navigate("/home");
    } catch (err) {
      console.error(err);
    }
  };

  // 🔹 Manual Login / Signup
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const url = isSignup
        ? "https://meeting-project-be-production.up.railway.app/api/auth/signup"
        : "https://meeting-project-be-production.up.railway.app/api/auth/login";

      const res = await axios.post(url, form);

      localStorage.setItem("user", JSON.stringify(res.data));
      navigate("/home");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-teal-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {/* HEADER */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto bg-blue-500 rounded-xl flex items-center justify-center mb-3">
            <LogIn className="text-white" />
          </div>

          <h2 className="text-2xl font-bold">
            {isSignup ? "Create Account" : "Welcome Back"}
          </h2>

          <p className="text-gray-500 text-sm">
            {isSignup ? "Sign up to continue" : "Login to your account"}
          </p>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              onChange={handleChange}
              className="w-full p-3 border rounded-lg"
              required
            />
          )}

          <input
            type="email"
            name="email"
            placeholder="Email"
            onChange={handleChange}
            className="w-full p-3 border rounded-lg"
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            onChange={handleChange}
            className="w-full p-3 border rounded-lg"
            required
          />

          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700"
          >
            {isSignup ? "Sign Up" : "Login"}
          </button>
        </form>

        {/* DIVIDER */}
        <div className="my-5 text-center text-gray-400">OR</div>

        {/* GOOGLE LOGIN */}
        <div className="flex justify-center">
          <div className="relative w-full">
            <div className="absolute inset-0 opacity-0">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => console.log("Login Failed")}
              />
            </div>

            <button className="w-full border p-3 rounded-lg">
              Continue with Google
            </button>
          </div>
        </div>

        {/* TOGGLE */}
        <div className="text-center mt-6">
          {isSignup ? (
            <p>
              Already have an account?{" "}
              <button
                onClick={() => setIsSignup(false)}
                className="text-blue-600"
              >
                Login
              </button>
            </p>
          ) : (
            <p>
              Don't have an account?{" "}
              <button
                onClick={() => setIsSignup(true)}
                className="text-blue-600"
              >
                Sign Up
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
