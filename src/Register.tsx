import React, { useState } from 'react';
import { account, ID } from './lib/appwrite';
import { Models } from 'appwrite';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form } from "@/components/ui/form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters long" }),
  email: z.string().email(),
  password: z.string().min(8, { message: "Password must be at least 8 characters long" }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const Register: React.FC = () => {
  const [registeredUser, setRegisteredUser] = useState<Models.User<Models.Preferences> | null>(null);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function register(name: string, email: string, password: string): Promise<void> {
    try {
      await account.create(ID.unique(), email, password, name);
      // Automatically log in after registration
      await account.createEmailPasswordSession(email, password);
      setRegisteredUser(await account.get());
    } catch (error) {
      console.error(error);
      // You might want to show an error message to the user here
    }
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await register(values.name, values.email, values.password);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Create your account
          </h2>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <Input
                {...form.register("name")}
                type="text"
                placeholder="Full Name"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border"
              />
              {form.formState.errors.name && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.name.message}</p>
              )}
            </div>

            <div>
              <Input
                {...form.register("email")}
                type="email"
                placeholder="Email"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border"
              />
              {form.formState.errors.email && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <Input
                {...form.register("password")}
                type="password"
                placeholder="Password"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border"
              />
              {form.formState.errors.password && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            <div>
              <Input
                {...form.register("confirmPassword")}
                type="password"
                placeholder="Confirm Password"
                className="appearance-none rounded-md relative block w-full px-3 py-2 border"
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <div>
              <Button 
                type="submit" 
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Register
              </Button>
            </div>

            {registeredUser && (
              <div className="mt-4">
                <p className="text-center text-green-500">Successfully registered as {registeredUser.name}</p>
                <Button
                  type="button"
                  onClick={async () => {
                    await account.deleteSession('current');
                    setRegisteredUser(null);
                    form.reset();
                  }}
                  className="mt-2 w-full"
                >
                  Logout
                </Button>
              </div>
            )}

            <div className="text-center">
              <a href="/login" className="text-sm text-indigo-600 hover:text-indigo-500">
                Already have an account? Sign in
              </a>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default Register; 