import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore.js';

const Login = () => {
    const navigate = useNavigate();
    const { login, isLoading, error, clearError } = useAuthStore();

    const [form, setForm] = useState({
        email: '',
        password: '',
    });

    const handleChange = (e) => {
        clearError();
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const result = await login(form.email, form.password);
        if (result.success) {
            toast.success('Welcome back!');
            navigate('/dashboard');
        } else {
            toast.error(result.error);
        }
    };

    return (
        <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4">
            <div className="w-full max-w-md">

                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white">
                        Code<span className="text-[#238636]">Room</span>
                    </h1>
                    <p className="text-[#8b949e] mt-2 text-sm">
                        Technical interview platform
                    </p>
                </div>

                {/* Card */}
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-8">
                    <h2 className="text-xl font-semibold text-white mb-6">
                        Sign in to your account
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {/* Email */}
                        <div>
                            <label className="block text-sm text-[#8b949e] mb-1.5">
                                Email address
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                placeholder="you@example.com"
                                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#484f58] focus:outline-none focus:border-[#238636] focus:ring-1 focus:ring-[#238636] transition-colors"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm text-[#8b949e] mb-1.5">
                                Password
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                required
                                placeholder="••••••••"
                                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-white text-sm placeholder-[#484f58] focus:outline-none focus:border-[#238636] focus:ring-1 focus:ring-[#238636] transition-colors"
                            />
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="bg-[#1f1116] border border-[#f85149] rounded-lg px-3 py-2.5">
                                <p className="text-[#f85149] text-sm">{error}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-[#238636] hover:bg-[#2ea043] disabled:bg-[#238636]/50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg text-sm transition-colors mt-2"
                        >
                            {isLoading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                                    </svg>
                                    Signing in...
                                </span>
                            ) : 'Sign in'}
                        </button>
                    </form>
                </div>

                {/* Register link */}
                <p className="text-center text-[#8b949e] text-sm mt-6">
                    Don't have an account?{' '}
                    <Link
                        to="/register"
                        className="text-[#238636] hover:text-[#2ea043] font-medium transition-colors"
                    >
                        Create one
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;