import { useState, useEffect } from "react";
import { useUser } from "../lib/context/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { account, storage, BUCKET_ID } from "../lib/appwrite";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ID } from "appwrite";
import { useAvatar } from '@/lib/context/avatar';

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
  const { avatarUrl, setAvatarUrl } = useAvatar();
  // Separate error states for each form
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  
  const [usernameSuccess, setUsernameSuccess] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
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
    if (user.current?.prefs.avatarUrl) {
      setAvatarUrl(user.current.prefs.avatarUrl);
    }
  }, [user.current?.prefs.avatarUrl, setAvatarUrl, user]);

  const onUsernameSubmit = async (values: z.infer<typeof usernameSchema>) => {
    try {
      setUsernameError(null);
      setUsernameSuccess(null);
      
      await account.updateName(values.username);
      const updatedUser = await account.get();
      user.updateUser(updatedUser.prefs);
      
      setUsernameSuccess("Username updated successfully!");
    } catch (error) {
      console.error('Error updating username:', error);
      setUsernameError("Failed to update username. Please try again.");
    }
  };

  async function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    try {
      setEmailError(null);
      setEmailSuccess(null);
      
      await account.updateEmail(values.email, values.password);
      const updated = await account.get();
      user.updateUser(updated.prefs);
      
      setEmailSuccess("Email updated successfully!");
      emailForm.reset({ email: values.email, password: "" });
    } catch (err: unknown) {
      console.error('Email update error:', err);
      
      // Handle specific Appwrite error messages
      if ((err as { type?: string; message?: string }).type === 'user_already_exists') {
        setEmailError("An account with this email already exists");
      } else if ((err as { type?: string }).type === 'invalid_credentials') {
        setEmailError("Current password is incorrect");
      } else if ((err as { message?: string }).message) {
        setEmailError((err as { message: string }).message);
      } else {
        setEmailError('Failed to update email');
      }
      
      emailForm.setValue('email', values.email);
      emailForm.setValue('password', '');
    }
  };

  async function onPasswordSubmit(values: z.infer<typeof passwordSchema>) {
    try {
      setPasswordError(null);
      setPasswordSuccess(null);
      
      await account.updatePassword(values.newPassword, values.oldPassword);
      
      setPasswordSuccess("Password updated successfully!");
      passwordForm.reset();
    } catch (err: unknown) {
      console.error('Password update error:', err);
      if (err instanceof Error) {
        setPasswordError(err.message);
      } else {
        setPasswordError('Failed to update password');
      }
    }
  }

  const onAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setAvatarError(null);
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        setAvatarError('Please upload an image file');
        return;
      }

      setIsUploading(true);
      
      // Create local URL for immediate preview
      const localUrl = URL.createObjectURL(file);
      setAvatarUrl(localUrl);

      // Delete old avatar if it exists
      if (user.current?.prefs?.avatarId) {
        try {
          await storage.deleteFile(BUCKET_ID, user.current.prefs.avatarId);
        } catch (error) {
          console.error('Error deleting old avatar:', error);
        }
      }

      // Upload new file
      const uploadedFile = await storage.createFile(BUCKET_ID, ID.unique(), file);
      
      // Update user preferences with new avatar
      await user.updateAvatar(uploadedFile.$id);
      
      // Clean up local URL
      URL.revokeObjectURL(localUrl);
      
      // Get the server URL
      const serverUrl = storage.getFileView(BUCKET_ID, uploadedFile.$id);
      setAvatarUrl(serverUrl.toString());

      // Reset file input
      e.target.value = '';
      
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setAvatarError("Failed to upload avatar. Please try again.");
      setAvatarUrl(null); // Reset on error
    } finally {
      setIsUploading(false);
    }
  };

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
                  onChange={onAvatarUpload}
                  disabled={isUploading}
                />
                {avatarError && <p className="text-red-500 text-sm mt-1">{avatarError}</p>}
                {emailSuccess && <p className="text-green-500 text-sm mt-1">{emailSuccess}</p>}
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
                <p className="mt-1">{user.current?.$createdAt ? new Date(user.current.$createdAt).toLocaleDateString() : ''}</p>
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
            {usernameError && <p className="mb-4 text-red-500">{usernameError}</p>}
            {usernameSuccess && <p className="mb-4 text-green-500">{usernameSuccess}</p>}
            
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
            {emailError && <p className="mb-4 text-red-500">{emailError}</p>}
            {emailSuccess && <p className="mb-4 text-green-500">{emailSuccess}</p>}
            
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
            {passwordError && <p className="mb-4 text-red-500">{passwordError}</p>}
            {passwordSuccess && <p className="mb-4 text-green-500">{passwordSuccess}</p>}
            
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