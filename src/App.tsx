import React, { useState } from 'react';
import { account, ID } from './lib/appwrite';
import { Models } from 'appwrite';
import { Button } from "@/components/ui/button"

const App: React.FC = () => {
  const [loggedInUser, setLoggedInUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');

  async function login(email: string, password: string): Promise<void> {
    await account.createEmailPasswordSession(email, password);
    setLoggedInUser(await account.get());
  }

  return (
    <div>
      <p className="text-red-500">
        {loggedInUser ? `Logged in as ${loggedInUser.name}` : 'Not logged in'}
      </p>

      <form>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />

        <button type="button" onClick={() => login(email, password)}>
          Login
        </button>

        <button
          type="button"
          onClick={async () => {
            await account.create(ID.unique(), email, password, name);
            login(email, password);
          }}
        >
          Register
        </button>

        <button
          type="button"
          onClick={async () => {
            await account.deleteSession('current');
            setLoggedInUser(null);
          }}
        >
          Logout
        </button>
      </form>
    </div>
  );
};

export default App;
