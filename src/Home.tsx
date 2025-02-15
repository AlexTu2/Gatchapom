import React from 'react';
import { Button } from "@/components/ui/button"

const Home: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h1 className="text-center text-4xl font-extrabold text-gray-900">
            Welcome
          </h1>
          <p className="mt-2 text-center text-gray-600">
            Please sign in or create a new account to continue
          </p>
        </div>

        <div className="space-y-4">
          <Button 
            onClick={() => window.location.href = '/login'}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sign In
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/register'}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Create Account
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Home; 