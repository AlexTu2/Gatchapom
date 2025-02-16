import { useState } from "react";
import { useUser } from "../lib/context/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ID } from "appwrite";

const loginSchema = z.object({
  email: z.string()
    .email({ message: "Please enter a valid email address" })
    .trim()
    .toLowerCase(),
  password: z.string().min(8, { message: "Password must be at least 8 characters long" }),
});

const registerSchema = z.object({
  username: z.string()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(30, { message: "Username must be less than 30 characters" })
    .regex(/^[a-zA-Z0-9_-]+$/, { message: "Username can only contain letters, numbers, underscores and dashes" }),
  email: z.string()
    .email({ message: "Please enter a valid email address" })
    .trim()
    .toLowerCase(),
  password: z.string().min(8, { message: "Password must be at least 8 characters long" }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export function Login() {
  const user = useUser();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onLoginSubmit(values: z.infer<typeof loginSchema>) {
    try {
      setError(null);
      await user.login(values.email.trim().toLowerCase(), values.password);
    } catch (err) {
      console.error('Login error:', err);
      setError('Invalid email or password');
    }
  }

  async function onRegisterSubmit(values: z.infer<typeof registerSchema>) {
    try {
      setError(null);
      const cleanEmail = values.email.trim().toLowerCase();
      if (!cleanEmail.includes('@')) {
        setError('Please enter a valid email address');
        return;
      }
      await user.register(
        values.username.trim(),
        cleanEmail,
        values.password
      );
    } catch (err: any) {
      console.error('Registration error:', err);
      if (err?.message?.includes('email')) {
        setError('Please enter a valid email address');
      } else if (err?.code === 409) {
        setError('An account with this email already exists');
      } else {
        setError('Registration failed. Please try again.');
      }
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h1 className="text-center text-4xl font-extrabold text-gray-900">
            {isRegistering ? "Create Account" : "Sign In"}
          </h1>
          <p className="mt-2 text-center text-gray-600">
            {isRegistering 
              ? "Already have an account?" 
              : "Don't have an account yet?"
            }
            {" "}
            <button
              onClick={() => {
                setError(null);
                setIsRegistering(!isRegistering);
              }}
              className="text-indigo-600 hover:text-indigo-500"
            >
              {isRegistering ? "Sign in" : "Create one"}
            </button>
          </p>
          {error && (
            <p className="mt-2 text-center text-red-500">{error}</p>
          )}
        </div>

        {isRegistering ? (
          <Form {...registerForm}>
            <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
              <div>
                <Input
                  placeholder="Username"
                  {...registerForm.register("username")}
                />
                {registerForm.formState.errors.username && (
                  <p className="text-red-500 text-sm mt-1">{registerForm.formState.errors.username.message}</p>
                )}
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  {...registerForm.register("email")}
                />
                {registerForm.formState.errors.email && (
                  <p className="text-red-500 text-sm mt-1">{registerForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  {...registerForm.register("password")}
                />
                {registerForm.formState.errors.password && (
                  <p className="text-red-500 text-sm mt-1">{registerForm.formState.errors.password.message}</p>
                )}
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Confirm Password"
                  {...registerForm.register("confirmPassword")}
                />
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-red-500 text-sm mt-1">{registerForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full">
                Create Account
              </Button>
            </form>
          </Form>
        ) : (
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Email"
                  {...loginForm.register("email")}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-red-500 text-sm mt-1">{loginForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  {...loginForm.register("password")}
                />
                {loginForm.formState.errors.password && (
                  <p className="text-red-500 text-sm mt-1">{loginForm.formState.errors.password.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full">
                Sign In
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
