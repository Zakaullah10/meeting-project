import { GoogleLogin } from "@react-oauth/google";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export const Login = () => {
  const navigate = useNavigate();

  const handleSuccess = async (credentialResponse) => {
    try {
      const res = await axios.post("https://meeting-project-be-production.up.railway.app/api/auth/google", {
        token: credentialResponse.credential,
      });

      console.log(res.data);

      // ✅ Save user
      localStorage.setItem("user", JSON.stringify(res.data));

      // ✅ Redirect to home
      navigate("/home");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <div className="p-6 bg-white shadow rounded">
        <h2 className="mb-4 text-xl font-bold">Login</h2>

        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => console.log("Login Failed")}
        />
      </div>
    </div>
  );
};
