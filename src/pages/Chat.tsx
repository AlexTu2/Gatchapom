import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUser } from "@/lib/context/user";
import { databases, DATABASE_ID, client, MESSAGES_COLLECTION_ID } from "@/lib/appwrite";
import { ID, Models, Query, Permission, Role } from "appwrite";

interface Message extends Models.Document {
  content: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: string;
}

export function Chat() {
  const user = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load initial messages
    loadMessages();

    // Subscribe to new messages
    const unsubscribe = client.subscribe([
      `databases.${DATABASE_ID}.collections.${MESSAGES_COLLECTION_ID}.documents`
    ], response => {
      if (response.events.includes('databases.*.collections.*.documents.*.create')) {
        const newMessage = response.payload as Message;
        setMessages(prev => [...prev, newMessage]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadMessages = async () => {
    try {
      const response = await databases.listDocuments<Message>(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        [
          Query.orderDesc('createdAt'),
          Query.limit(50)
        ]
      );
      setMessages(response.documents.reverse());
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user.current) return;

    setIsLoading(true);
    try {
      await databases.createDocument(
        DATABASE_ID,
        MESSAGES_COLLECTION_ID,
        ID.unique(),
        {
          content: newMessage.trim(),
          userId: user.current.$id,
          userName: user.current.name,
          userAvatar: user.current.prefs.avatarUrl,
          createdAt: new Date().toISOString(),
        },
        [
          Permission.read(Role.any()),
          Permission.update(Role.user(user.current.$id)),
          Permission.delete(Role.user(user.current.$id)),
        ]
      );
      setNewMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-4xl h-[80vh]">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Chat Room</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col h-full">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.map((message) => (
              <div 
                key={message.$id}
                className={`flex items-start gap-3 ${
                  message.userId === user.current?.$id ? 'flex-row-reverse' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                  {message.userAvatar ? (
                    <img 
                      src={message.userAvatar} 
                      alt={message.userName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium">
                      {message.userName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className={`max-w-[70%] ${
                  message.userId === user.current?.$id ? 'text-right' : ''
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{message.userName}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(message.createdAt)}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 p-3 rounded-lg ${
                    message.userId === user.current?.$id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100'
                  }`}>
                    {message.content}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Input Area */}
          <form onSubmit={sendMessage} className="flex gap-4">
            <Input 
              placeholder="Type your message..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}