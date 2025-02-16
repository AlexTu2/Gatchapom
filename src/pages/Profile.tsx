import { useState, useEffect } from "react";
import { useUser } from "../lib/context/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { account, storage, BUCKET_ID, getAvatarUrl } from "../lib/appwrite";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ID } from "appwrite";

const usernameSchema = z.object({
  username: z.string()
    .min(3, { message: "Username must be at least 3 characters long" })
    .max(30, { message: "Username must be less than 30 characters" })
    .regex(/^[a-zA-Z0-9_-]+$/, { message: "Username can only contain letters, numbers, underscores and dashes" }),
});

const emailSchema = z.object({
  email: z.string()
    .email({ message: "Please enter a valid email address" })
    .trim()
    .toLowerCase(),
  password: z.string().min(8, { message: "Password required to change email" }),
});

const passwordSchema = z.object({
  oldPassword: z.string().min(8, { message: "Password must be at least 8 characters long" }),
  newPassword: z.string().min(8, { message: "Password must be at least 8 characters long" }),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export function Profile() {
  const user = useUser();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const usernameForm = useForm<z.infer<typeof usernameSchema>>({
    resolver: zodResolver(usernameSchema),
    defaultValues: {
      username: user.current?.name || "",
    },
  });

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: user.current?.email || "",
      password: "",
    },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (user.current?.prefs?.avatarUrl) {
      setAvatarUrl(user.current.prefs.avatarUrl.toString());
    } else {
      setAvatarUrl(null);
    }
  }, [user.current?.prefs?.avatarUrl]);

  async function onUsernameSubmit(values: z.infer<typeof usernameSchema>) {
    try {
      setError(null);
      setSuccess(null);
      
      await account.updateName(values.username);
      
      // Update the user context
      const updated = await account.get();
      user.current = updated;
      
      setSuccess("Username updated successfully!");
    } catch (err: any) {
      console.error('Username update error:', err);
      setError(err?.message || 'Failed to update username');
    }
  }

  async function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    try {
      setError(null);
      setSuccess(null);
      
      await account.updateEmail(values.email, values.password);
      
      // Update the user context
      const updated = await account.get();
      user.current = updated;
      
      setSuccess("Email updated successfully!");
      emailForm.reset({ email: values.email, password: "" });
    } catch (err: any) {
      console.error('Email update error:', err);
      setError(err?.message || 'Failed to update email');
    }
  }

  async function onPasswordSubmit(values: z.infer<typeof passwordSchema>) {
    try {
      setError(null);
      setSuccess(null);
      
      await account.updatePassword(values.newPassword, values.oldPassword);
      
      setSuccess("Password updated successfully!");
      passwordForm.reset();
    } catch (err: any) {
      console.error('Password update error:', err);
      setError(err?.message || 'Failed to update password');
    }
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setIsUploading(true);
      setError(null);
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }

      // Delete old avatar if it exists
      if (user.current?.prefs?.avatarId) {
        try {
          await storage.deleteFile(BUCKET_ID, user.current.prefs.avatarId);
        } catch (error) {
          console.error('Error deleting old avatar:', error);
        }
      }

      // Upload new file
      const response = await storage.createFile(
        BUCKET_ID,
        ID.unique(),
        file
      );

      // Update user preferences with new avatar
      const updatedPrefs = await user.updateAvatar(response.$id);
      
      // Force a new URL object with cache-busting
      if (updatedPrefs?.avatarUrl) {
        const url = new URL(updatedPrefs.avatarUrl.toString());
        url.searchParams.set('v', Date.now().toString());
        setAvatarUrl(url.toString());
      }
      
      setSuccess("Profile picture updated successfully!");
      event.target.value = '';
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      setError(err?.message || 'Failed to upload profile picture');
      setAvatarUrl(null);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Avatar Card */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              {avatarUrl ? (
                <div className="relative h-24 w-24">
                  <img
                    key={avatarUrl}
                    src={avatarUrl}
                    alt="Profile"
                    className="h-24 w-24 rounded-full object-cover"
                    onError={() => setAvatarUrl(null)}
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-24 w-24 rounded-full bg-gray-200 flex items-center justify-center text-xl">
                  {user.current?.name?.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />
                {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                {success && <p className="text-green-500 text-sm mt-1">{success}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* User Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">User ID</label>
                <p className="mt-1">{user.current?.$id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Username</label>
                <p className="mt-1">{user.current?.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="mt-1">{user.current?.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Account Created</label>
                <p className="mt-1">{new Date(user.current?.$createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Update Username Form */}
        <Card>
          <CardHeader>
            <CardTitle>Update Username</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...usernameForm}>
              <form onSubmit={usernameForm.handleSubmit(onUsernameSubmit)} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Username</label>
                  <Input
                    placeholder="Username"
                    {...usernameForm.register("username")}
                  />
                  {usernameForm.formState.errors.username && (
                    <p className="text-red-500 text-sm mt-1">{usernameForm.formState.errors.username.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  Update Username
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Update Email Form */}
        <Card>
          <CardHeader>
            <CardTitle>Update Email</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...emailForm}>
              <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">New Email</label>
                  <Input
                    type="email"
                    placeholder="Email"
                    {...emailForm.register("email")}
                  />
                  {emailForm.formState.errors.email && (
                    <p className="text-red-500 text-sm mt-1">{emailForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Current Password</label>
                  <Input
                    type="password"
                    placeholder="Enter your current password"
                    {...emailForm.register("password")}
                  />
                  {emailForm.formState.errors.password && (
                    <p className="text-red-500 text-sm mt-1">{emailForm.formState.errors.password.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  Update Email
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Change Password Form */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="mb-4 text-red-500">{error}</p>}
            {success && <p className="mb-4 text-green-500">{success}</p>}
            
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Current Password</label>
                  <Input
                    type="password"
                    placeholder="Current Password"
                    {...passwordForm.register("oldPassword")}
                  />
                  {passwordForm.formState.errors.oldPassword && (
                    <p className="text-red-500 text-sm mt-1">{passwordForm.formState.errors.oldPassword.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">New Password</label>
                  <Input
                    type="password"
                    placeholder="New Password"
                    {...passwordForm.register("newPassword")}
                  />
                  {passwordForm.formState.errors.newPassword && (
                    <p className="text-red-500 text-sm mt-1">{passwordForm.formState.errors.newPassword.message}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Confirm New Password</label>
                  <Input
                    type="password"
                    placeholder="Confirm New Password"
                    {...passwordForm.register("confirmPassword")}
                  />
                  {passwordForm.formState.errors.confirmPassword && (
                    <p className="text-red-500 text-sm mt-1">{passwordForm.formState.errors.confirmPassword.message}</p>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  Update Password
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 