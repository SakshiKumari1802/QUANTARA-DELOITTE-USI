import { useState } from "react";
import axios from "axios";

type Mode = "choice" | "login" | "signup";

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>("choice");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (mode === "login") {
        const res = await axios.post("http://localhost:5000/auth/login", {
          email: form.email,
          password: form.password,
        });

        localStorage.setItem("token", res.data.token);
        window.location.reload();
      }

      if (mode === "signup") {
        await axios.post("http://localhost:5000/auth/signup", {
          name: form.name,
          email: form.email,
          password: form.password,
        });

        setMode("login");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Authentication failed");
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT BRAND PANEL */}
      <div className="hidden md:flex w-1/2 bg-gray-900 text-white items-center justify-center">
        <div className="text-center px-10">
          <h1 className="text-4xl font-bold mb-4">QUANTARA</h1>
          <p className="text-gray-400">
            AI-Powered B2B Route Intelligence Platform
          </p>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-xl w-full max-w-md">
          
          {/* 🔹 MODE 1: CHOICE SCREEN */}
          {mode === "choice" && (
            <>
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-2">
                Welcome
              </h2>
              <p className="text-sm text-gray-500 mb-6">
                Access the Quantara Dashboard
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => setMode("login")}
                  className="w-full bg-lime-600 hover:bg-lime-700 text-white py-2 rounded font-semibold"
                >
                  Sign In
                </button>

                <button
                  onClick={() => setMode("signup")}
                  className="w-full border border-lime-600 text-lime-600 hover:bg-lime-50 py-2 rounded font-semibold"
                >
                  Create Account
                </button>
              </div>
            </>
          )}

          {/* 🔹 MODE 2: LOGIN */}
          {mode === "login" && (
            <>
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-1">
                Sign In
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Welcome back to Quantara
              </p>

              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full px-3 py-2 rounded border dark:bg-gray-700 dark:text-white"
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  required
                />

                <input
                  type="password"
                  placeholder="Password"
                  className="w-full px-3 py-2 rounded border dark:bg-gray-700 dark:text-white"
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                />

                <button className="w-full bg-lime-600 hover:bg-lime-700 text-white py-2 rounded font-semibold">
                  Sign In
                </button>
              </form>

              <p className="text-sm text-center text-gray-500 mt-4">
                New here?{" "}
                <button
                  className="text-lime-500 font-semibold"
                  onClick={() => setMode("signup")}
                >
                  Create account
                </button>
              </p>
            </>
          )}

          {/* 🔹 MODE 3: SIGNUP */}
          {mode === "signup" && (
            <>
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-1">
                Create Account
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Start using Quantara
              </p>

              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  placeholder="Full Name"
                  className="w-full px-3 py-2 rounded border dark:bg-gray-700 dark:text-white"
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  required
                />

                <input
                  type="email"
                  placeholder="Email"
                  className="w-full px-3 py-2 rounded border dark:bg-gray-700 dark:text-white"
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  required
                />

                <input
                  type="password"
                  placeholder="Password"
                  className="w-full px-3 py-2 rounded border dark:bg-gray-700 dark:text-white"
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  required
                />

                <button className="w-full bg-lime-600 hover:bg-lime-700 text-white py-2 rounded font-semibold">
                  Sign Up
                </button>
              </form>

              <p className="text-sm text-center text-gray-500 mt-4">
                Already have an account?{" "}
                <button
                  className="text-lime-500 font-semibold"
                  onClick={() => setMode("login")}
                >
                  Sign in
                </button>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
